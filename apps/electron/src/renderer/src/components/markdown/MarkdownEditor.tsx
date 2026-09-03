import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  SquareCode,
  Link as LinkIcon
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { getParagraphHashQuery, normalizeMarkdown } from '../../lib/markdown'
import { isMacPlatform } from '../../lib/platform'
import {
  formatShortcutHint,
  isConflictingEditorShortcut,
  matchMarkdownShortcut,
  type MarkdownShortcutAction
} from '../../lib/markdownShortcuts'

export type MarkdownEditorHandle = {
  focus: () => void
  getMarkdown: () => string
  removeHashToken: () => void
}

export type MarkdownEditorKeyHandler = (event: KeyboardEvent) => boolean

type ToolbarButtonProps = {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}

function ToolbarButton({ label, active, disabled, onClick, children }: ToolbarButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors',
        'hover:bg-muted/70 hover:text-foreground disabled:opacity-40',
        active && 'bg-muted text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function getMarkdown(editor: Editor | null): string {
  if (!editor) return ''
  return editor.getMarkdown()
}

function findHashRange(editor: Editor): { from: number; to: number } | null {
  const { $from } = editor.state.selection
  const text = $from.parent.textBetween(0, $from.parentOffset, '\n', '\n')
  const lastHash = text.lastIndexOf('#')
  if (lastHash === -1) return null
  const after = text.slice(lastHash + 1)
  if (after.includes(' ') || after.includes('\n')) return null
  return { from: $from.start() + lastHash, to: $from.pos }
}

function promptForLink(editor: Editor): void {
  const previous = (editor.getAttributes('link').href as string | undefined) ?? 'https://'
  const url = window.prompt('Link URL', previous)
  if (url === null) return
  if (url.trim() === '') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
}

function runMarkdownShortcut(editor: Editor, action: MarkdownShortcutAction): boolean {
  switch (action) {
    case 'bold':
      return editor.chain().focus().toggleBold().run()
    case 'italic':
      return editor.chain().focus().toggleItalic().run()
    case 'strike':
      return editor.chain().focus().toggleStrike().run()
    case 'code':
      return editor.chain().focus().toggleCode().run()
    case 'codeBlock':
      return editor.chain().focus().toggleCodeBlock().run()
    case 'link':
      promptForLink(editor)
      return true
    case 'heading':
      return editor.chain().focus().toggleHeading({ level: 2 }).run()
    case 'bulletList':
      return editor.chain().focus().toggleBulletList().run()
    case 'orderedList':
      return editor.chain().focus().toggleOrderedList().run()
    case 'taskList':
      return editor.chain().focus().toggleTaskList().run()
    case 'blockquote':
      return editor.chain().focus().toggleBlockquote().run()
  }
}

function MarkdownToolbar({ editor }: { editor: Editor }): React.JSX.Element {
  const icon = 'h-3.5 w-3.5'
  const isMac = isMacPlatform()
  const hint = (...parts: Array<'Mod' | 'Shift' | 'Alt' | string>): string =>
    formatShortcutHint(isMac, parts)
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border/50 px-1.5 py-1">
      <ToolbarButton
        label={`Bold (${hint('Mod', 'B')})`}
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label={`Italic (${hint('Mod', 'I')})`}
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label={`Strikethrough (${hint('Mod', 'Shift', 'X')})`}
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label={`Heading (${hint('Mod', 'Alt', '2')})`}
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label={`Bullet list (${hint('Mod', 'Shift', '8')})`}
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label={`Numbered list (${hint('Mod', 'Shift', '7')})`}
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label={`Checklist (${hint('Mod', 'Shift', '0')})`}
        active={editor.isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListTodo className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label={`Quote (${hint('Mod', 'Shift', '9')})`}
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label={`Code (${hint('Mod', 'Shift', 'C')})`}
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label={`Code block (${hint('Mod', 'Alt', 'Shift', 'C')})`}
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <SquareCode className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label={`Link (${hint('Mod', 'Shift', 'U')})`}
        active={editor.isActive('link')}
        onClick={() => promptForLink(editor)}
      >
        <LinkIcon className={icon} />
      </ToolbarButton>
    </div>
  )
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = '',
  compact = false,
  autoFocus = false,
  disabled = false,
  showToolbar = true,
  className,
  contentClassName,
  editorRef,
  onSubmit,
  onEscape,
  onHashQuery,
  onKeyDown
}: {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  compact?: boolean
  autoFocus?: boolean
  disabled?: boolean
  showToolbar?: boolean
  className?: string
  contentClassName?: string
  editorRef?: React.Ref<MarkdownEditorHandle>
  onSubmit?: () => void
  onEscape?: () => void
  onHashQuery?: (query: string | null) => void
  onKeyDown?: MarkdownEditorKeyHandler
}): React.JSX.Element {
  const onChangeRef = useRef(onChange)
  const onSubmitRef = useRef(onSubmit)
  const onEscapeRef = useRef(onEscape)
  const onHashQueryRef = useRef(onHashQuery)
  const onKeyDownRef = useRef(onKeyDown)
  const instanceRef = useRef<Editor | null>(null)
  onChangeRef.current = onChange
  onSubmitRef.current = onSubmit
  onEscapeRef.current = onEscape
  onHashQueryRef.current = onHashQuery
  onKeyDownRef.current = onKeyDown

  const reportHash = useCallback((instance: Editor) => {
    const { $from } = instance.state.selection
    const text = $from.parent.textBetween(0, $from.parentOffset, '\n', '\n')
    onHashQueryRef.current?.(getParagraphHashQuery(text))
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          protocols: ['http', 'https', 'mailto']
        }
      }),
      Markdown.configure({
        markedOptions: { gfm: true, breaks: false }
      }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true })
    ],
    content: value,
    contentType: 'markdown',
    editable: !disabled,
    autofocus: autoFocus ? 'end' : false,
    immediatelyRender: true,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: cn('markdown-editor-content outline-none', compact ? 'is-compact' : 'is-default')
      },
      handleKeyDown: (_view, event) => {
        if (onKeyDownRef.current?.(event)) return true
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()
          onSubmitRef.current?.()
          return true
        }
        if (event.key === 'Escape') {
          onEscapeRef.current?.()
          return Boolean(onEscapeRef.current)
        }
        const instance = instanceRef.current
        const action = matchMarkdownShortcut(event)
        if (instance && action) {
          event.preventDefault()
          return runMarkdownShortcut(instance, action)
        }
        if (isConflictingEditorShortcut(event)) {
          event.preventDefault()
          return true
        }
        return false
      }
    },
    onUpdate: ({ editor: instance }) => {
      onChangeRef.current(getMarkdown(instance))
      reportHash(instance)
    },
    onSelectionUpdate: ({ editor: instance }) => {
      reportHash(instance)
    }
  })

  instanceRef.current = editor

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [disabled, editor])

  useEffect(() => {
    if (!editor) return
    const current = getMarkdown(editor)
    if (normalizeMarkdown(current) === normalizeMarkdown(value)) return
    if (editor.isFocused && value !== '') return
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
  }, [editor, value])

  useImperativeHandle(
    editorRef,
    () => ({
      focus: () => {
        editor?.commands.focus('end')
      },
      getMarkdown: () => getMarkdown(editor),
      removeHashToken: () => {
        if (!editor) return
        const range = findHashRange(editor)
        if (!range) return
        editor.chain().focus().deleteRange(range).run()
      }
    }),
    [editor]
  )

  const handleDomKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation()
  }, [])

  return (
    <div
      className={cn(
        'markdown-editor overflow-hidden rounded-xl border border-transparent bg-background/55',
        'focus-within:ring-2 focus-within:ring-primary/30',
        className
      )}
      onKeyDown={handleDomKeyDown}
    >
      {showToolbar && editor ? <MarkdownToolbar editor={editor} /> : null}
      <EditorContent editor={editor} className={cn('markdown-editor-shell', contentClassName)} />
    </div>
  )
}
