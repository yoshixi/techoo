import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CalendarDays,
  CheckSquare,
  ChevronRight,
  MessageSquare,
  Settings,
  StickyNote,
} from 'lucide-react-native';
import { Text } from '@/components/ui/text';

type Row = {
  key: string;
  title: string;
  subtitle: string;
  href: '/calendar' | '/todos' | '/logbook' | '/notes' | '/settings';
  Icon: typeof CalendarDays;
};

const ROWS: Row[] = [
  {
    key: 'cal',
    title: 'Calendar',
    subtitle: 'Week & day grid, Google events',
    href: '/calendar',
    Icon: CalendarDays,
  },
  {
    key: 'todo',
    title: 'All to-dos',
    subtitle: 'Open items across days',
    href: '/todos',
    Icon: CheckSquare,
  },
  {
    key: 'log',
    title: 'Logbook',
    subtitle: 'Recent posts across days',
    href: '/logbook',
    Icon: MessageSquare,
  },
  {
    key: 'notes',
    title: 'Notes',
    subtitle: 'Off the day timeline',
    href: '/notes',
    Icon: StickyNote,
  },
  {
    key: 'settings',
    title: 'Settings',
    subtitle: 'Account & calendars',
    href: '/settings',
    Icon: Settings,
  },
];

export default function LibraryScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-2 pb-4">
        <Text className="text-sm text-muted-foreground">
          Deeper views and tools — the day stays on Today.
        </Text>
      </View>
      <View className="px-4">
        {ROWS.map((row) => (
          <Pressable
            key={row.key}
            onPress={() => router.push(row.href)}
            className="mb-2 flex-row items-center rounded-xl border border-border bg-card px-4 py-3.5 active:opacity-80"
          >
            <View className="mr-3 rounded-lg bg-muted p-2">
              <row.Icon size={22} className="text-foreground" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-base font-medium text-foreground">{row.title}</Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">{row.subtitle}</Text>
            </View>
            <ChevronRight size={20} className="text-muted-foreground" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
