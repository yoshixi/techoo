# 20241118_inline_table_task_management_ui

## Overview

This document provides complete instructions for AI coding agents to reproduce a clean, inline table-based task management UI for Electron applications using React, TypeScript, and shadcn/ui components.

## UI Requirements

### Core Features
- **Single-page table view** for task management
- **Inline task creation** directly within the table
- **No separate forms or modals** for adding tasks
- **Keyboard shortcuts** for efficient task creation
- **Real-time status filtering**
- **Edit/delete actions** per task row

### Visual Design
- Clean, modern dark theme
- Table-first layout with full width
- Highlighted add-task row with primary color accent
- Responsive design with proper spacing
- shadcn/ui component library integration

## Technical Architecture

### Dependencies Required
```json
{
  "@radix-ui/react-dialog": "^1.x.x",
  "@radix-ui/react-select": "^2.x.x",
  "class-variance-authority": "^0.x.x",
  "clsx": "^2.x.x",
  "lucide-react": "^0.x.x",
  "react": "^18.x.x || ^19.x.x",
  "react-dom": "^18.x.x || ^19.x.x",
  "tailwind-merge": "^2.x.x",
  "tailwindcss": "^3.x.x"
}
```

### Required UI Components
Ensure these shadcn/ui components are installed:
- `button`
- `card`
- `dialog`
- `input`
- `label`
- `select`
- `table`
- `textarea`

Install with: `npx shadcn@latest add button card dialog input label select table textarea`

### TypeScript Configuration
Add path aliases to `tsconfig.web.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@renderer/*": ["src/renderer/src/*"],
      "@/*": ["src/renderer/src/*"]
    }
  }
}
```

## Data Model

### Task Interface
```typescript
type TaskStatus = 'To Do' | 'In Progress' | 'Done'

interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  dueDate?: string
  createdAt: string
  updatedAt: string
}
```

### State Management
```typescript
const [tasks, setTasks] = useState<Task[]>(seedTasks)
const [editingTask, setEditingTask] = useState<Task | null>(null)
const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all')
const [isAddingTask, setIsAddingTask] = useState(false)
const [newTaskFields, setNewTaskFields] = useState({
  title: '',
  description: '',
  dueDate: ''
})
```

## Component Structure

### Main Layout
```jsx
<div className="min-h-screen p-8">
  <main className="mx-auto max-w-6xl">
    <header className="mb-8 text-center">
      {/* App title and description */}
    </header>
    
    <Card>
      <CardHeader>
        {/* Title, description, and controls */}
      </CardHeader>
      <CardContent>
        <Table>
          {/* Table implementation */}
        </Table>
      </CardContent>
    </Card>
    
    {/* Edit dialog */}
  </main>
</div>
```

### Header Controls
Position in CardHeader with flex layout:
```jsx
<CardHeader className="flex flex-row items-center justify-between space-y-0">
  <div>
    <CardTitle>Tasks</CardTitle>
    <CardDescription>Manage your task list</CardDescription>
  </div>
  <div className="flex items-center gap-4">
    {/* Status filter dropdown */}
    {!isAddingTask && (
      <Button onClick={() => setIsAddingTask(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add Task
      </Button>
    )}
  </div>
</CardHeader>
```

## Inline Task Creation Implementation

### Add Task Row Structure
```jsx
{isAddingTask && (
  <TableRow className="border-primary/50 bg-primary/5">
    <TableCell>
      <Input
        placeholder="Enter task title"
        value={newTaskFields.title}
        onChange={(e) => setNewTaskFields(prev => ({ ...prev, title: e.target.value }))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCreateTask()
          else if (e.key === 'Escape') handleCancelAdd()
        }}
        autoFocus
      />
    </TableCell>
    <TableCell>
      <Input
        placeholder="Enter description"
        value={newTaskFields.description}
        onChange={(e) => setNewTaskFields(prev => ({ ...prev, description: e.target.value }))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCreateTask()
          else if (e.key === 'Escape') handleCancelAdd()
        }}
      />
    </TableCell>
    <TableCell>
      <Select value="To Do" disabled>
        <SelectTrigger className="w-[130px]">
          <SelectValue />
        </SelectTrigger>
      </Select>
    </TableCell>
    <TableCell>
      <Input
        type="date"
        value={newTaskFields.dueDate}
        onChange={(e) => setNewTaskFields(prev => ({ ...prev, dueDate: e.target.value }))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleCreateTask()
          else if (e.key === 'Escape') handleCancelAdd()
        }}
      />
    </TableCell>
    <TableCell>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleCreateTask} disabled={!newTaskFields.title.trim()}>
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancelAdd}>
          Cancel
        </Button>
      </div>
    </TableCell>
  </TableRow>
)}
```

### Key Event Handlers
```typescript
function handleCreateTask(): void {
  if (!newTaskFields.title.trim()) return

  const now = new Date().toISOString()
  const task: Task = {
    id: createId(),
    title: newTaskFields.title.trim(),
    description: newTaskFields.description.trim(),
    status: 'To Do',
    dueDate: newTaskFields.dueDate || undefined,
    createdAt: now,
    updatedAt: now
  }

  setTasks(prev => [task, ...prev])
  setNewTaskFields({ title: '', description: '', dueDate: '' })
  setIsAddingTask(false)
}

function handleCancelAdd(): void {
  setNewTaskFields({ title: '', description: '', dueDate: '' })
  setIsAddingTask(false)
}
```

## Table Implementation Details

### Table Structure
```jsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Title</TableHead>
      <TableHead>Description</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Due Date</TableHead>
      <TableHead>Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {/* Inline add task row */}
    {/* Existing task rows */}
    {/* Empty state */}
  </TableBody>
</Table>
```

### Task Row Template
```jsx
<TableRow key={task.id}>
  <TableCell className="font-medium">{task.title}</TableCell>
  <TableCell className="max-w-xs truncate">
    {task.description || '-'}
  </TableCell>
  <TableCell>
    <Select 
      value={task.status} 
      onValueChange={(status) => handleStatusChange(task.id, status)}
    >
      <SelectTrigger className="w-[130px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((status) => (
          <SelectItem key={status} value={status}>
            {status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </TableCell>
  <TableCell>
    <div className="flex items-center gap-2">
      <CalendarDays className="h-4 w-4" />
      {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
    </div>
  </TableCell>
  <TableCell>
    <div className="flex items-center gap-2">
      <Button size="icon" variant="ghost" onClick={() => setEditingTask(task)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" onClick={() => handleDeleteTask(task.id)}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  </TableCell>
</TableRow>
```

## User Experience Features

### Keyboard Shortcuts
- **Enter:** Save task (works in any input field of the add row)
- **Escape:** Cancel task creation
- **Auto-focus:** Title field receives focus when add mode is activated

### Visual States
- **Add Task Row:** `border-primary/50 bg-primary/5` for highlighting
- **Save Button:** Disabled state when title is empty
- **Add Button:** Hidden during task creation mode

### Responsive Behavior
- Table scrolls horizontally on smaller screens
- Button sizes adapt to screen size
- Proper spacing maintained across devices

## Edit Task Dialog

Maintain existing edit functionality using a modal dialog:
```jsx
<EditTaskDialog
  task={editingTask}
  onOpenChange={(open) => !open && setEditingTask(null)}
  onSubmit={handleUpdateTask}
/>
```

## Utility Functions

### Required Helper Functions
```typescript
function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    weekday: 'short'
  })
}

function createId(): number {
  return Date.now()
}
```

## Styling Requirements

### Tailwind Classes
- Use consistent spacing: `p-8`, `mb-8`, `gap-4`, `gap-2`
- Text colors: `text-white`, `text-muted-foreground`, `text-destructive`
- Interactive states: `hover:`, `disabled:`, `focus:`
- Layout: `flex`, `grid`, `max-w-6xl`, `mx-auto`

### Component Variants
- Button sizes: `sm`, `icon`
- Button variants: `default`, `ghost`, `outline`
- Table cell styling: `font-medium`, `max-w-xs truncate`

## Implementation Steps

1. **Setup shadcn/ui components** and ensure proper TypeScript configuration
2. **Create the data model** and state management hooks
3. **Build the main layout** with header and single-card structure
4. **Implement the table structure** with proper headers
5. **Add inline task creation row** with all input fields and keyboard handlers
6. **Implement task management functions** (create, update, delete, filter)
7. **Add the edit dialog** for existing tasks
8. **Style with proper spacing** and responsive design
9. **Test keyboard shortcuts** and user interactions
10. **Verify accessibility** and proper focus management

## Testing Checklist

- [ ] Add task button shows/hides correctly
- [ ] Inline row appears with proper styling
- [ ] All input fields work and accept keyboard shortcuts
- [ ] Save button enables/disables based on title input
- [ ] Cancel button resets form and closes add mode
- [ ] Enter key saves task from any input field
- [ ] Escape key cancels task creation
- [ ] Status filter works correctly
- [ ] Edit dialog opens and saves changes
- [ ] Delete functionality removes tasks
- [ ] Date formatting displays correctly
- [ ] Responsive design works on different screen sizes

This implementation provides a streamlined, efficient task management interface focused on inline editing and keyboard accessibility.
