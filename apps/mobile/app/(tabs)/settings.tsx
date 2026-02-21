import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsContent } from '@/components/settings/SettingsContent';

export default function SettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['left', 'right']}>
      <ScrollView className="flex-1">
        <View className="p-4">
          <SettingsContent />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
