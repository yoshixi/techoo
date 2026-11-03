import { listItemRecordId } from './ids';
import type { JournalRecord, JsonValue } from './types';
import { SyncError } from './types';
import type { SyncStore } from './store';

export type JournalContext = {
  deviceId: string;
  nowIso: string;
  newId: () => string;
};

export type TodoView = {
  id: number;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_all_day: number;
  done: number;
  done_at: string | null;
  created_at: string;
};

export type NoteView = {
  id: number;
  title: string;
  body: string | null;
  pinned: number;
  created_at: string;
  updated_at: string;
};

export type PostView = {
  id: number;
  parent_post_id: number | null;
  body: string;
  posted_at: string;
  events: { id: number; title: string }[];
  todos: { id: number; title: string }[];
  is_favorited: boolean;
  list_ids: number[];
  reply_count: number;
};

export type PostListView = {
  id: number;
  name: string;
  created_at: number;
};

export type TodoQuery = {
  from?: string;
  to?: string;
  done?: 'true' | 'false';
  unscheduled?: boolean;
  limit?: number;
};

export type PostQuery = {
  from?: string;
  to?: string;
  offset?: number;
  limit?: number;
  favorite?: boolean;
  listLocalId?: number;
  listLocalIds?: number[];
};

type Fields = { [key: string]: JsonValue };

function str(fields: Fields, key: string, fallback = ''): string {
  const value = fields[key];
  return typeof value === 'string' ? value : fallback;
}

function strOrNull(fields: Fields, key: string): string | null {
  const value = fields[key];
  return typeof value === 'string' ? value : null;
}

function flag(fields: Fields, key: string): number {
  return fields[key] === true ? 1 : 0;
}

function textOrNull(fields: Fields, key: string): string | null {
  const value = fields[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function stringArray(value: JsonValue | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function eventArray(value: JsonValue | undefined): { id: number; title: string }[] {
  if (!Array.isArray(value)) return [];
  const events: { id: number; title: string }[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    if (typeof item.id !== 'number') continue;
    events.push({ id: item.id, title: typeof item.title === 'string' ? item.title : '' });
  }
  return events;
}

async function load(store: SyncStore): Promise<JournalRecord[]> {
  return store.listRecords();
}

function byId(records: JournalRecord[]): Map<string, JournalRecord> {
  return new Map(records.map((record) => [record.recordId, record]));
}

async function requireLive(
  store: SyncStore,
  kind: JournalRecord['kind'],
  localId: number
): Promise<JournalRecord> {
  const found = (await load(store)).find(
    (record) => record.kind === kind && record.localId === localId && !record.deleted
  );
  if (!found) throw new SyncError('not_found', `${kind} ${localId} was not found`);
  return found;
}

function clearedPending(
  record: JournalRecord,
  ctx: JournalContext,
  fields: Fields,
  deleted: boolean
): JournalRecord {
  return {
    ...record,
    fields,
    deleted,
    updatedAt: ctx.nowIso,
    deviceId: ctx.deviceId,
    dirty: true,
    pendingClientOpId: null,
    pendingNonce: null,
    pendingCiphertext: null,
    pendingUpdatedAt: null,
  };
}

async function edit(
  store: SyncStore,
  record: JournalRecord,
  ctx: JournalContext,
  fields: Fields,
  deleted = false
): Promise<JournalRecord> {
  const next = clearedPending(record, ctx, fields, deleted);
  await store.saveRecord(next);
  return next;
}

async function insert(
  store: SyncStore,
  ctx: JournalContext,
  kind: JournalRecord['kind'],
  fields: Fields,
  local: boolean,
  recordId = ctx.newId()
): Promise<JournalRecord> {
  const record: JournalRecord = {
    recordId,
    kind,
    localId: local ? await store.nextLocalId(kind) : null,
    deleted: false,
    updatedAt: ctx.nowIso,
    deviceId: ctx.deviceId,
    fields,
    dirty: true,
    lastSeq: null,
    pendingClientOpId: null,
    pendingNonce: null,
    pendingCiphertext: null,
    pendingUpdatedAt: null,
  };
  await store.saveRecord(record);
  return record;
}

function projectTodo(record: JournalRecord): TodoView {
  const fields = record.fields;
  return {
    id: record.localId ?? 0,
    title: str(fields, 'title'),
    description: textOrNull(fields, 'description'),
    starts_at: textOrNull(fields, 'startsAt'),
    ends_at: textOrNull(fields, 'endsAt'),
    is_all_day: flag(fields, 'isAllDay'),
    done: flag(fields, 'done'),
    done_at: textOrNull(fields, 'doneAt'),
    created_at: str(fields, 'createdAt'),
  };
}

function projectNote(record: JournalRecord): NoteView {
  const fields = record.fields;
  return {
    id: record.localId ?? 0,
    title: str(fields, 'title', 'Untitled'),
    body: textOrNull(fields, 'body'),
    pinned: flag(fields, 'pinned'),
    created_at: str(fields, 'createdAt'),
    updated_at: record.updatedAt,
  };
}

function projectList(record: JournalRecord): PostListView {
  return {
    id: record.localId ?? 0,
    name: str(record.fields, 'name'),
    created_at: Math.floor(Date.parse(str(record.fields, 'createdAt')) / 1000),
  };
}

function projectPost(
  record: JournalRecord,
  records: JournalRecord[],
  index: Map<string, JournalRecord>
): PostView {
  const fields = record.fields;
  const parentRecordId = strOrNull(fields, 'parentRecordId');
  const parent = parentRecordId ? index.get(parentRecordId) : undefined;
  const todos = stringArray(fields.todoRecordIds).flatMap((id) => {
    const todo = index.get(id);
    if (!todo || todo.localId == null) return [];
    return [{ id: todo.localId, title: str(todo.fields, 'title') }];
  });
  const listIds = records.flatMap((item) => {
    if (item.kind !== 'post_list_item' || item.deleted) return [];
    if (str(item.fields, 'postRecordId') !== record.recordId) return [];
    const list = index.get(str(item.fields, 'listRecordId'));
    if (!list || list.deleted || list.localId == null) return [];
    return [list.localId];
  });
  const favorited = record.fields.favorited === true;
  const replyCount = records.filter(
    (item) =>
      item.kind === 'post' &&
      !item.deleted &&
      strOrNull(item.fields, 'parentRecordId') === record.recordId
  ).length;
  return {
    id: record.localId ?? 0,
    parent_post_id: parent && !parent.deleted && parent.localId != null ? parent.localId : null,
    body: str(fields, 'body'),
    posted_at: str(fields, 'postedAt'),
    events: eventArray(fields.events),
    todos,
    is_favorited: favorited,
    list_ids: listIds,
    reply_count: replyCount,
  };
}

function live(records: JournalRecord[], kind: JournalRecord['kind']): JournalRecord[] {
  return records.filter(
    (record) => record.kind === kind && !record.deleted && record.localId != null
  );
}

export async function queryTodos(store: SyncStore, query: TodoQuery = {}): Promise<TodoView[]> {
  const records = live(await load(store), 'todo').map(projectTodo);
  const ranged = query.from != null && query.to != null;
  const filtered = records.filter((todo) => {
    if (query.done === 'false' && todo.done !== 0) return false;
    if (query.done === 'true' && todo.done !== 1) return false;
    if (query.from == null && query.to == null) return true;
    if (todo.starts_at == null) return Boolean(query.unscheduled) && ranged;
    if (query.from != null && todo.starts_at < query.from) return false;
    if (query.to != null && todo.starts_at >= query.to) return false;
    return true;
  });
  filtered.sort((a, b) => {
    if ((a.starts_at == null) !== (b.starts_at == null)) return a.starts_at == null ? 1 : -1;
    if (a.starts_at !== b.starts_at) return (a.starts_at ?? '') < (b.starts_at ?? '') ? -1 : 1;
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
    return a.id - b.id;
  });
  return filtered.slice(0, query.limit ?? 500);
}

export async function createTodo(
  store: SyncStore,
  ctx: JournalContext,
  input: {
    title: string;
    description?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
    isAllDay?: number;
  }
): Promise<TodoView> {
  const record = await insert(
    store,
    ctx,
    'todo',
    {
      title: input.title,
      createdAt: ctx.nowIso,
      done: false,
      isAllDay: (input.isAllDay ?? 0) === 1,
      ...(input.description ? { description: input.description } : {}),
      ...(input.startsAt ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt ? { endsAt: input.endsAt } : {}),
    },
    true
  );
  return projectTodo(record);
}

export async function updateTodo(
  store: SyncStore,
  ctx: JournalContext,
  localId: number,
  input: {
    title?: string;
    description?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
    isAllDay?: number;
    done?: number;
  }
): Promise<TodoView> {
  const current = await requireLive(store, 'todo', localId);
  const fields: Fields = { ...current.fields };
  if (input.title !== undefined) fields.title = input.title;
  if (input.description !== undefined) {
    if (input.description) fields.description = input.description;
    else delete fields.description;
  }
  if (input.startsAt !== undefined) {
    if (input.startsAt) fields.startsAt = input.startsAt;
    else delete fields.startsAt;
  }
  if (input.endsAt !== undefined) {
    if (input.endsAt) fields.endsAt = input.endsAt;
    else delete fields.endsAt;
  }
  if (input.isAllDay !== undefined) fields.isAllDay = input.isAllDay === 1;
  if (input.done !== undefined) {
    fields.done = input.done === 1;
    if (input.done === 1) fields.doneAt = ctx.nowIso;
    else delete fields.doneAt;
  }
  return projectTodo(await edit(store, current, ctx, fields, false));
}

export async function deleteTodo(
  store: SyncStore,
  ctx: JournalContext,
  localId: number
): Promise<void> {
  const current = await requireLive(store, 'todo', localId);
  await edit(store, current, ctx, {}, true);
}

export async function queryNotes(store: SyncStore): Promise<NoteView[]> {
  return live(await load(store), 'note')
    .map(projectNote)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned - a.pinned;
      if (a.updated_at !== b.updated_at) return a.updated_at < b.updated_at ? 1 : -1;
      return b.id - a.id;
    });
}

export async function getNote(store: SyncStore, localId: number): Promise<NoteView | null> {
  const record = (await load(store)).find(
    (item) => item.kind === 'note' && item.localId === localId && !item.deleted
  );
  return record ? projectNote(record) : null;
}

export async function createNote(
  store: SyncStore,
  ctx: JournalContext,
  input: { title: string; body: string | null }
): Promise<NoteView> {
  const record = await insert(
    store,
    ctx,
    'note',
    {
      title: input.title,
      createdAt: ctx.nowIso,
      pinned: false,
      ...(input.body ? { body: input.body } : {}),
    },
    true
  );
  return projectNote(record);
}

export async function updateNote(
  store: SyncStore,
  ctx: JournalContext,
  localId: number,
  title: string,
  body: string | null
): Promise<NoteView> {
  const current = await requireLive(store, 'note', localId);
  const fields: Fields = { ...current.fields, title };
  if (body) fields.body = body;
  else delete fields.body;
  return projectNote(await edit(store, current, ctx, fields, false));
}

export async function setNotePinned(
  store: SyncStore,
  ctx: JournalContext,
  localId: number,
  pinned: number
): Promise<NoteView> {
  const current = await requireLive(store, 'note', localId);
  return projectNote(
    await edit(store, current, ctx, { ...current.fields, pinned: pinned === 1 }, false)
  );
}

export async function deleteNote(
  store: SyncStore,
  ctx: JournalContext,
  localId: number
): Promise<void> {
  const current = await requireLive(store, 'note', localId);
  await edit(store, current, ctx, {}, true);
}

async function keepLocal(store: SyncStore, record: JournalRecord): Promise<JournalRecord> {
  const next = {
    ...record,
    dirty: false,
    pendingClientOpId: null,
    pendingNonce: null,
    pendingCiphertext: null,
    pendingUpdatedAt: null,
  };
  await store.saveRecord(next);
  return next;
}

function livePosts(records: JournalRecord[], index: Map<string, JournalRecord>): PostView[] {
  return live(records, 'post').map((record) => projectPost(record, records, index));
}

export async function queryPosts(
  store: SyncStore,
  query: PostQuery = {}
): Promise<{ posts: PostView[]; hasMore: boolean }> {
  const records = await load(store);
  const index = byId(records);
  let posts = livePosts(records, index).filter((post) => post.parent_post_id == null);
  if (query.favorite) posts = posts.filter((post) => post.is_favorited);
  if (query.listLocalId != null)
    posts = posts.filter((post) => post.list_ids.includes(query.listLocalId!));
  if (query.listLocalIds != null && query.listLocalIds.length > 0) {
    const ids = query.listLocalIds;
    posts = posts.filter((post) => ids.some((id) => post.list_ids.includes(id)));
  }
  if (query.from != null || query.to != null) {
    posts = posts.filter((post) => {
      if (query.from != null && post.posted_at < query.from) return false;
      if (query.to != null && post.posted_at >= query.to) return false;
      return true;
    });
    posts.sort((a, b) =>
      a.posted_at < b.posted_at ? -1 : a.posted_at > b.posted_at ? 1 : a.id - b.id
    );
    const limit = query.limit ?? 1000;
    return { posts: posts.slice(0, limit), hasMore: posts.length > limit };
  }
  posts.sort((a, b) =>
    a.posted_at < b.posted_at ? 1 : a.posted_at > b.posted_at ? -1 : b.id - a.id
  );
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 30;
  const page = posts.slice(offset, offset + limit);
  return { posts: page, hasMore: offset + limit < posts.length };
}

export async function getThread(
  store: SyncStore,
  localId: number
): Promise<{ root: PostView; replies: PostView[] } | null> {
  const records = await load(store);
  const index = byId(records);
  const rootRecord = records.find(
    (record) => record.kind === 'post' && record.localId === localId && !record.deleted
  );
  if (!rootRecord) return null;
  const root = projectPost(rootRecord, records, index);
  const replies = live(records, 'post')
    .filter((record) => strOrNull(record.fields, 'parentRecordId') === rootRecord.recordId)
    .map((record) => projectPost(record, records, index))
    .sort((a, b) => (a.posted_at < b.posted_at ? -1 : a.posted_at > b.posted_at ? 1 : a.id - b.id));
  return { root, replies };
}

export async function createPost(
  store: SyncStore,
  ctx: JournalContext,
  input: {
    body: string;
    parentLocalId?: number | null;
    postedAt?: string;
    todoLocalIds?: number[];
    events?: { id: number; title: string }[];
  }
): Promise<PostView> {
  const records = await load(store);
  let parentRecordId: string | null = null;
  if (input.parentLocalId != null) {
    const parent = await requireLive(store, 'post', input.parentLocalId);
    parentRecordId = parent.recordId;
  }
  const todoRecordIds = (input.todoLocalIds ?? [])
    .flatMap((id) => {
      const todo = records.find(
        (record) => record.kind === 'todo' && record.localId === id && !record.deleted
      );
      return todo ? [todo.recordId] : [];
    })
    .sort();
  const events = [...(input.events ?? [])].sort((a, b) => a.id - b.id);
  const fields: Fields = {
    body: input.body.trim(),
    postedAt: input.postedAt ?? ctx.nowIso,
  };
  if (parentRecordId) fields.parentRecordId = parentRecordId;
  if (todoRecordIds.length > 0) fields.todoRecordIds = todoRecordIds;
  if (events.length > 0) fields.events = events;
  const record = await insert(store, ctx, 'post', fields, true);
  const next = await load(store);
  return projectPost(record, next, byId(next));
}

export async function updatePostBody(
  store: SyncStore,
  ctx: JournalContext,
  localId: number,
  body: string
): Promise<PostView> {
  const current = await requireLive(store, 'post', localId);
  const record = await edit(store, current, ctx, { ...current.fields, body: body.trim() }, false);
  const records = await load(store);
  return projectPost(record, records, byId(records));
}

export async function deletePost(
  store: SyncStore,
  ctx: JournalContext,
  localId: number
): Promise<void> {
  const current = await requireLive(store, 'post', localId);
  await edit(store, current, ctx, {}, true);
  const replies = (await load(store)).filter(
    (record) =>
      record.kind === 'post' &&
      !record.deleted &&
      strOrNull(record.fields, 'parentRecordId') === current.recordId
  );
  for (const reply of replies) await edit(store, reply, ctx, {}, true);
}

export async function queryLists(store: SyncStore): Promise<PostListView[]> {
  return live(await load(store), 'post_list')
    .map(projectList)
    .sort((a, b) => a.created_at - b.created_at || a.id - b.id);
}

export async function createList(
  store: SyncStore,
  ctx: JournalContext,
  name: string
): Promise<PostListView> {
  const trimmed = name.trim();
  if (!trimmed) throw new SyncError('invalid', 'List name is required');
  return projectList(
    await keepLocal(
      store,
      await insert(store, ctx, 'post_list', { name: trimmed, createdAt: ctx.nowIso }, true)
    )
  );
}

export async function renameList(
  store: SyncStore,
  ctx: JournalContext,
  localId: number,
  name: string
): Promise<PostListView> {
  const trimmed = name.trim();
  if (!trimmed) throw new SyncError('invalid', 'List name is required');
  const current = await requireLive(store, 'post_list', localId);
  return projectList(
    await keepLocal(
      store,
      await edit(store, current, ctx, { ...current.fields, name: trimmed }, false)
    )
  );
}

export async function deleteList(
  store: SyncStore,
  ctx: JournalContext,
  localId: number
): Promise<void> {
  const current = await requireLive(store, 'post_list', localId);
  await keepLocal(store, await edit(store, current, ctx, {}, true));
  const items = (await load(store)).filter(
    (record) =>
      record.kind === 'post_list_item' &&
      !record.deleted &&
      str(record.fields, 'listRecordId') === current.recordId
  );
  for (const item of items) await keepLocal(store, await edit(store, item, ctx, item.fields, true));
}

export async function setPostListMembership(
  store: SyncStore,
  ctx: JournalContext,
  postLocalId: number,
  listLocalId: number,
  member: boolean
): Promise<void> {
  const post = await requireLive(store, 'post', postLocalId);
  const list = await requireLive(store, 'post_list', listLocalId);
  const recordId = listItemRecordId(list.recordId, post.recordId);
  const fields: Fields = { listRecordId: list.recordId, postRecordId: post.recordId };
  const existing = await store.getRecord(recordId);
  if (!existing) {
    if (!member) return;
    await keepLocal(store, await insert(store, ctx, 'post_list_item', fields, false, recordId));
    return;
  }
  await keepLocal(store, await edit(store, existing, ctx, fields, !member));
}

export async function setPostFavorite(
  store: SyncStore,
  ctx: JournalContext,
  postLocalId: number,
  favorited: boolean
): Promise<void> {
  const post = await requireLive(store, 'post', postLocalId);
  const fields: Fields = { ...post.fields };
  if (favorited) fields.favorited = true;
  else delete fields.favorited;
  await edit(store, post, ctx, fields, false);
}
