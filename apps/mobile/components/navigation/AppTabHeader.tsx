import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings } from 'lucide-react-native';
import { Text } from '@/components/ui/text';

/** App chrome shared across main tabs — screen title + global actions (e.g. settings). */
export function AppTabHeader({
  title,
  showSettings = true,
}: {
  title: string;
  showSettings?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="border-b border-border/25 bg-background"
      style={{ paddingTop: insets.top, paddingHorizontal: 16, paddingBottom: 8 }}
    >
      <View className="min-h-10 flex-row items-center justify-between gap-3">
        <Text className="min-w-0 flex-1 text-2xl font-semibold text-foreground" numberOfLines={1}>
          {title}
        </Text>
        {showSettings ? (
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            className="h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card"
          >
            <Settings size={18} className="text-foreground" />
          </Pressable>
        ) : (
          <View className="h-10 w-10 shrink-0" />
        )}
      </View>
    </View>
  );
}
