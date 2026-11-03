import { emitJournal } from './events';
import type { SyncEngine } from './engine';
import {
  createList,
  createNote,
  createPost,
  createTodo,
  deleteList,
  deleteNote,
  deletePost,
  deleteTodo,
  getNote,
  getThread,
  queryLists,
  queryNotes,
  queryPosts,
  queryTodos,
  renameList,
  setNotePinned,
  setPostFavorite,
  setPostListMembership,
  updateNote,
  updatePostBody,
  updateTodo,
  type JournalContext,
  type NoteView,
  type PostListView,
  type PostQuery,
  type PostView,
  type TodoQuery,
  type TodoView,
} from './journal';
import type { SyncStore } from './store';
import type { SyncResult } from './types';

/**
 * Serializes journal writes and sync against one store. Headless tests and the
 * React Native app both use this class; the app supplies the Expo SQLite store.
 */
export class JournalService {
  lastSync: SyncResult | null = null;
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    readonly store: SyncStore,
    readonly engine: SyncEngine,
    private readonly onWrite?: () => void
  ) {}

  exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn, fn);
    this.tail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private async context(): Promise<JournalContext> {
    return {
      deviceId: await this.engine.deviceId(),
      nowIso: this.engine.nowIso(),
      newId: () => this.engine.newId(),
    };
  }

  private publish<T>(promise: Promise<T>): Promise<T> {
    return promise.then((value) => {
      emitJournal();
      this.onWrite?.();
      return value;
    });
  }

  sync(): Promise<SyncResult> {
    return this.exclusive(async () => {
      const result = await this.engine.sync();
      this.lastSync = result;
      emitJournal();
      return result;
    });
  }

  queryTodos(query?: TodoQuery): Promise<TodoView[]> {
    return this.exclusive(() => queryTodos(this.store, query));
  }

  queryNotes(): Promise<NoteView[]> {
    return this.exclusive(() => queryNotes(this.store));
  }

  getNote(localId: number): Promise<NoteView | null> {
    return this.exclusive(() => getNote(this.store, localId));
  }

  queryPosts(query?: PostQuery): Promise<{ posts: PostView[]; hasMore: boolean }> {
    return this.exclusive(() => queryPosts(this.store, query));
  }

  getThread(localId: number): Promise<{ root: PostView; replies: PostView[] } | null> {
    return this.exclusive(() => getThread(this.store, localId));
  }

  queryLists(): Promise<PostListView[]> {
    return this.exclusive(() => queryLists(this.store));
  }

  createTodo(input: Parameters<typeof createTodo>[2]): Promise<TodoView> {
    return this.publish(
      this.exclusive(async () => createTodo(this.store, await this.context(), input))
    );
  }

  updateTodo(localId: number, input: Parameters<typeof updateTodo>[3]): Promise<TodoView> {
    return this.publish(
      this.exclusive(async () => updateTodo(this.store, await this.context(), localId, input))
    );
  }

  deleteTodo(localId: number): Promise<void> {
    return this.publish(
      this.exclusive(async () => deleteTodo(this.store, await this.context(), localId))
    );
  }

  createNote(input: Parameters<typeof createNote>[2]): Promise<NoteView> {
    return this.publish(
      this.exclusive(async () => createNote(this.store, await this.context(), input))
    );
  }

  updateNote(localId: number, title: string, body: string | null): Promise<NoteView> {
    return this.publish(
      this.exclusive(async () => updateNote(this.store, await this.context(), localId, title, body))
    );
  }

  setNotePinned(localId: number, pinned: number): Promise<NoteView> {
    return this.publish(
      this.exclusive(async () => setNotePinned(this.store, await this.context(), localId, pinned))
    );
  }

  deleteNote(localId: number): Promise<void> {
    return this.publish(
      this.exclusive(async () => deleteNote(this.store, await this.context(), localId))
    );
  }

  createPost(input: Parameters<typeof createPost>[2]): Promise<PostView> {
    return this.publish(
      this.exclusive(async () => createPost(this.store, await this.context(), input))
    );
  }

  updatePostBody(localId: number, body: string): Promise<PostView> {
    return this.publish(
      this.exclusive(async () => updatePostBody(this.store, await this.context(), localId, body))
    );
  }

  deletePost(localId: number): Promise<void> {
    return this.publish(
      this.exclusive(async () => deletePost(this.store, await this.context(), localId))
    );
  }

  createList(name: string): Promise<PostListView> {
    return this.publish(
      this.exclusive(async () => createList(this.store, await this.context(), name))
    );
  }

  renameList(localId: number, name: string): Promise<PostListView> {
    return this.publish(
      this.exclusive(async () => renameList(this.store, await this.context(), localId, name))
    );
  }

  deleteList(localId: number): Promise<void> {
    return this.publish(
      this.exclusive(async () => deleteList(this.store, await this.context(), localId))
    );
  }

  setPostListMembership(postLocalId: number, listLocalId: number, member: boolean): Promise<void> {
    return this.publish(
      this.exclusive(async () =>
        setPostListMembership(this.store, await this.context(), postLocalId, listLocalId, member)
      )
    );
  }

  setPostFavorite(postLocalId: number, favorited: boolean): Promise<void> {
    return this.publish(
      this.exclusive(async () =>
        setPostFavorite(this.store, await this.context(), postLocalId, favorited)
      )
    );
  }
}
