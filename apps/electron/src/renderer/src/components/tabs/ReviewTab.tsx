import React, { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { Badge } from '../ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/table'
import type { Task, TaskTimer } from '../../gen/api'
import {
  aggregateDailyTimers,
  aggregateTimersByTag,
  aggregateTaskTimerSummaries,
  formatDurationShort
} from '../../lib/timer-aggregation'

interface ReviewTabProps {
  allTasks: Task[]
  timers: TaskTimer[]
  timersByTaskId: Map<number, TaskTimer[]>
  onTaskSelect: (task: Task) => void
}

export function ReviewTab({
  allTasks,
  timers,
  timersByTaskId,
  onTaskSelect
}: ReviewTabProps): React.JSX.Element {
  const dailyData = useMemo(() => aggregateDailyTimers(timers, 14), [timers])
  const tagData = useMemo(() => aggregateTimersByTag(allTasks, timersByTaskId), [allTasks, timersByTaskId])
  const taskSummaries = useMemo(() => aggregateTaskTimerSummaries(allTasks, timersByTaskId), [allTasks, timersByTaskId])

  const formatDateLabel = (dateStr: string): string => {
    const [, month, day] = dateStr.split('-')
    return `${Number(month)}/${Number(day)}`
  }

  return (
    <div className="space-y-6">
      {/* Daily Hours Chart */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Daily Hours (Last 14 Days)
        </h3>
        <div className="rounded-lg border bg-card p-4">
          {dailyData.every((d) => d.hours === 0) ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              No timer data in the last 14 days.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyData}>
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                  tickFormatter={(v: number) => `${v}h`}
                />
                <Tooltip
                  formatter={(value) => [`${value}h`, 'Hours']}
                  labelFormatter={(label) => formatDateLabel(String(label))}
                />
                <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tag Breakdown */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Time by Tag
        </h3>
        <div className="rounded-lg border bg-card p-4">
          {tagData.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              No tag data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(120, tagData.length * 36)}>
              <BarChart data={tagData} layout="vertical">
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}h`}
                />
                <YAxis
                  type="category"
                  dataKey="tagName"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip formatter={(value) => [`${value}h`, 'Hours']} />
                <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Task Time Summary Table */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Task Summary
        </h3>
        {taskSummaries.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No timer sessions recorded yet.
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-right">Total Time</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taskSummaries.map(({ task, totalMs, sessionCount }) => (
                  <TableRow
                    key={task.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onTaskSelect(task)}
                  >
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {task.tags && task.tags.length > 0 ? (
                          task.tags.map((tag) => (
                            <Badge key={tag.id} variant="outline" className="text-xs px-1.5 py-0">
                              {tag.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatDurationShort(totalMs)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {sessionCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
