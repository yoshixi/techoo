import { View, ScrollView } from 'react-native';
import { SettingsContent } from '@/components/settings/SettingsContent';

export default function SettingsScreen() {
  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1">
        <View className="p-4">
          <SettingsContent />
        </View>
      </ScrollView>
    </View>
  );
}
