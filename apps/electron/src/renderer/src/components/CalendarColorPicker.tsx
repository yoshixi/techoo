import React, { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { HexColorInput, HexColorPicker } from 'react-colorful'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'
import {
  CALENDAR_COLOR_PALETTE,
  normalizeHexColor
} from '../lib/calendar-colors'

interface CalendarColorPickerProps {
  color?: string
  onSelect: (color: string) => void
}

export function CalendarColorPicker({
  color,
  onSelect
}: CalendarColorPickerProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const selected = normalizeHexColor(color ?? '') ?? '#6366F1'
  const [draft, setDraft] = useState(selected)

  useEffect(() => {
    if (open) setDraft(selected)
  }, [open, selected])

  const handleDone = (): void => {
    const next = normalizeHexColor(draft)
    if (next) onSelect(next)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
        title="Change calendar color"
        aria-label="Change calendar color"
        onClick={() => setOpen(true)}
      >
        <span
          className="h-5 w-5 rounded-full border border-black/10"
          style={{ backgroundColor: selected }}
        />
        <span>Color</span>
        <Pencil className="h-3 w-3 text-muted-foreground" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Pick a color</DialogTitle>
            <p className="text-sm text-muted-foreground">Used for this calendar’s events</p>
          </DialogHeader>
          <div className="space-y-3">
            <HexColorPicker
              color={draft}
              onChange={(next) => {
                const normalized = normalizeHexColor(next)
                if (normalized) setDraft(normalized)
              }}
              style={{ width: '100%', height: 180 }}
            />
            <div className="flex items-center gap-2">
              <span
                className="h-7 w-7 shrink-0 rounded-md border border-border"
                style={{ backgroundColor: draft }}
              />
              <HexColorInput
                color={draft}
                prefixed
                onChange={(next) => {
                  const normalized = normalizeHexColor(next)
                  if (normalized) setDraft(normalized)
                }}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                aria-label="Hex color"
              />
            </div>
            <div className="grid grid-cols-6 gap-2">
              {CALENDAR_COLOR_PALETTE.map((paletteColor) => (
                <button
                  key={paletteColor}
                  type="button"
                  className="h-6 w-6 rounded-full border border-border"
                  style={{ backgroundColor: paletteColor }}
                  aria-label={`Preset ${paletteColor}`}
                  onClick={() => setDraft(paletteColor)}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleDone}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
