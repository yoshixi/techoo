import { Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';

export function FloatingCreateButton({
  onPress,
  bottomInset,
  accessibilityLabel,
}: {
  onPress: () => void;
  bottomInset: number;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="absolute right-4 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg active:opacity-85"
      style={{ bottom: Math.max(bottomInset + 14, 24), elevation: 6 }}
    >
      <Plus size={24} className="text-primary-foreground" strokeWidth={2.5} />
    </Pressable>
  );
}
