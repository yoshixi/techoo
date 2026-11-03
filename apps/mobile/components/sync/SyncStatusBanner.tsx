import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useEncryptedSync, useJournalMode } from '@/lib/journal/runtime';

/** Offline and pending hint once the journal lives on this device. */
export function SyncStatusBanner() {
  const mode = useJournalMode();
  const journal = useEncryptedSync();
  if (mode !== 'local' || !journal.status) return null;
  const { status, pending, message } = journal.status;
  if (status === 'ok' && pending === 0) return null;
  const label =
    status === 'offline'
      ? `Offline. ${pending} change${pending === 1 ? '' : 's'} waiting to sync.`
      : status === 'locked'
        ? 'Encrypted sync is locked. Open Settings to unlock.'
        : status === 'vault_reset'
          ? 'This vault was replaced. Open Settings to join the new one.'
          : status === 'error'
            ? (message ?? 'Sync needs attention. Open Settings.')
            : pending > 0
              ? `${pending} change${pending === 1 ? '' : 's'} waiting to sync.`
              : null;
  if (!label) return null;
  return (
    <View className="bg-muted px-4 py-2">
      <Text className="text-center text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}
