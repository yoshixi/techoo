import React, { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

const PRESETS = [
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 90, label: '1.5h' },
  { value: 120, label: '2h' },
]

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

export function DurationPicker({ value, onChange }: { value: number; onChange: (minutes: number) => void }): React.JSX.Element {
  const [isCustom, setIsCustom] = useState(() => !PRESETS.some(p => p.value === value))
  const [customValue, setCustomValue] = useState(() => String(value))

  if (isCustom) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <Input
          type="number"
          min={1}
          autoFocus
          value={customValue}
          onChange={(e) => {
            setCustomValue(e.target.value)
            const num = Number(e.target.value)
            if (num > 0) onChange(num)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const num = Number(customValue)
              if (num > 0) {
                onChange(num)
                // Stay in custom mode with the value set
              }
            }
            if (e.key === 'Escape') {
              setIsCustom(false)
              onChange(30)
            }
          }}
          className="h-8 w-16 text-xs text-center"
        />
        <span className="text-xs text-muted-foreground">m</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { setIsCustom(false); onChange(30) }}
          className="h-7 px-1.5 text-xs text-muted-foreground"
        >
          ×
        </Button>
      </div>
    )
  }

  const isPreset = PRESETS.some(p => p.value === value)

  return (
    <Select
      value={isPreset ? String(value) : 'custom'}
      onValueChange={(v) => {
        if (v === 'custom') {
          setIsCustom(true)
          setCustomValue(String(value))
        } else {
          onChange(Number(v))
        }
      }}
    >
      <SelectTrigger className="h-8 w-20 text-xs shrink-0">
        <SelectValue>{isPreset ? formatDuration(value) : `${value}m`}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PRESETS.map(p => (
          <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
        ))}
        <SelectItem value="custom">Custom...</SelectItem>
      </SelectContent>
    </Select>
  )
}
