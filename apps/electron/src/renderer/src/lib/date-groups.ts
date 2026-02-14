import type { Task } from '../gen/api'

export type DateGroup = 'Today' | 'Tomorrow' | 'This Week' | 'Later'

export interface GroupedTasks {
  label: DateGroup
  tasks: Task[]
}

export function groupTasksByDate(tasks: Task[]): GroupedTasks[] {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = new Date(todayStart.getTime() + 86400000)
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 86400000)

  // End of week (Sunday)
  const dayOfWeek = now.getDay()
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
  const weekEnd = new Date(todayStart.getTime() + (daysUntilSunday + 1) * 86400000)

  const groups: Record<DateGroup, Task[]> = {
    Today: [],
    Tomorrow: [],
    'This Week': [],
    Later: []
  }

  for (const task of tasks) {
    if (!task.startAt) {
      groups.Later.push(task)
      continue
    }

    const taskDate = new Date(task.startAt)
    if (taskDate < tomorrowStart) {
      groups.Today.push(task)
    } else if (taskDate < tomorrowEnd) {
      groups.Tomorrow.push(task)
    } else if (taskDate < weekEnd) {
      groups['This Week'].push(task)
    } else {
      groups.Later.push(task)
    }
  }

  const order: DateGroup[] = ['Today', 'Tomorrow', 'This Week', 'Later']
  return order
    .filter((label) => groups[label].length > 0)
    .map((label) => ({ label, tasks: groups[label] }))
}
