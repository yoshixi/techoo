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
      className="absolute right-4 h-14 w-14 items-center justify-center rounded-full border border-amber-700/30 bg-amber-600 shadow-lg active:opacity-90"
      style={{ bottom: Math.max(bottomInset + 14, 24), elevation: 5 }}
    >
      <Plus size={24} color="#FFF7ED" strokeWidth={2.25} />
    </Pressable>
  );
}
