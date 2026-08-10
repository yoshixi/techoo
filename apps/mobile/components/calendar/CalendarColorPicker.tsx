import { useEffect, useState } from 'react'
import { Modal, Pressable, View } from 'react-native'
import { Pencil } from 'lucide-react-native'
import ColorPicker, {
  HueSlider,
  Panel1,
  PreviewText,
  Swatches,
} from 'reanimated-color-picker'
import { Text } from '@/components/ui/text'
import { Button } from '@/components/ui/button'
import {
  CALENDAR_COLOR_PALETTE,
  normalizeHexColor,
} from '@/lib/calendar-colors'

interface CalendarColorPickerProps {
  color?: string
  onSelect: (color: string) => void
}

export function CalendarColorPicker({ color, onSelect }: CalendarColorPickerProps) {
  const [open, setOpen] = useState(false)
  const selected = normalizeHexColor(color ?? '') ?? '#6366F1'
  const [draft, setDraft] = useState(selected)

  useEffect(() => {
    if (open) setDraft(selected)
  }, [open, selected])

  const handleDone = () => {
    const next = normalizeHexColor(draft)
    if (next) onSelect(next)
    setOpen(false)
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Change calendar color"
        className="flex-row items-center gap-2 rounded-full border border-border bg-muted/40 px-2.5 py-1.5 active:bg-muted/70"
      >
        <View
          className="h-5 w-5 rounded-full border border-black/10"
          style={{ backgroundColor: selected }}
        />
        <Text className="text-xs font-medium text-foreground">Color</Text>
        <Pencil size={12} className="text-muted-foreground" />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <Pressable
            className="absolute inset-0"
            onPress={() => setOpen(false)}
            accessibilityLabel="Dismiss color picker"
          />
          <View className="w-full max-w-sm rounded-xl border border-border bg-background p-4">
            <Text className="mb-1 text-sm font-medium">Pick a color</Text>
            <Text className="mb-3 text-xs text-muted-foreground">
              Used for this calendar’s events
            </Text>
            <ColorPicker
              value={draft}
              onChangeJS={(colors) => {
                const next = normalizeHexColor(colors.hex)
                if (next) setDraft(next)
              }}
              style={{ width: '100%', gap: 12 }}
            >
              <Panel1 style={{ height: 160, borderRadius: 12 }} />
              <HueSlider style={{ height: 28, borderRadius: 14 }} />
              <Swatches
                colors={[...CALENDAR_COLOR_PALETTE]}
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                swatchStyle={{ width: 28, height: 28, borderRadius: 14 }}
              />
              <PreviewText colorFormat="hex" style={{ textAlign: 'center' }} />
            </ColorPicker>
            <View className="mt-4 flex-row justify-end gap-2">
              <Button variant="ghost" size="sm" onPress={() => setOpen(false)}>
                <Text>Cancel</Text>
              </Button>
              <Button size="sm" onPress={handleDone}>
                <Text>Done</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}
