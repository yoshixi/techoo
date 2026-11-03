import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Lock, RefreshCw, Shield } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEncryptedSync } from '@/lib/journal/runtime';
import { SyncError } from '@/sync';

const MIN_PASSPHRASE = 8;

function messageFor(err: unknown): string {
  if (err instanceof SyncError) {
    if (err.code === 'wrong_passphrase') return 'That passphrase does not unlock this vault.';
    if (err.code === 'vault_exists') return 'A vault already exists. Unlock it instead.';
    if (err.code === 'vault_reset') return 'The vault was replaced. Join the new one below.';
    if (err.code === 'offline') return 'You are offline. Try again when this device is online.';
    return err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}

export function EncryptedSyncSection() {
  const sync = useEncryptedSync();
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [resetPassphrase, setResetPassphrase] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [remote, setRemote] = useState<'unknown' | 'none' | 'present' | 'offline'>('unknown');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sync.mode === 'local') return;
    let cancelled = false;
    void sync
      .probeVault()
      .then((result) => {
        if (!cancelled) setRemote(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(messageFor(err));
      });
    return () => {
      cancelled = true;
    };
  }, [sync.mode, sync.probeVault]);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setPassphrase('');
      setConfirm('');
      setResetPassphrase('');
      setResetConfirm('');
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const passphraseError =
    passphrase.length > 0 && passphrase.length < MIN_PASSPHRASE
      ? `Use at least ${MIN_PASSPHRASE} characters.`
      : confirm.length > 0 && confirm !== passphrase
        ? 'Passphrases do not match.'
        : null;

  return (
    <View className="gap-3 rounded-lg border border-border px-5 py-4">
      <View className="flex-row items-center gap-2">
        <Shield size={18} className="text-muted-foreground" />
        <Text className="text-sm font-medium">Encrypted sync</Text>
      </View>
      <Text className="text-sm text-muted-foreground">
        The passphrase never leaves this device. It wraps a random data key, and the server only
        stores ciphertext. To-dos, posts, and notes stay in on-device SQLite. Creating or joining a
        vault does not copy the existing cloud journal.
      </Text>
      {sync.mode === 'local' ? <LocalStatus /> : null}
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}

      {sync.mode === 'remote' && remote === 'unknown' ? <ActivityIndicator /> : null}

      {sync.mode === 'remote' && remote === 'none' ? (
        <View className="gap-3">
          <Input
            value={passphrase}
            onChangeText={setPassphrase}
            secureTextEntry
            placeholder="New passphrase"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            placeholder="Confirm passphrase"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {passphraseError ? (
            <Text className="text-xs text-destructive">{passphraseError}</Text>
          ) : null}
          <Button
            disabled={busy || passphrase.length < MIN_PASSPHRASE || passphrase !== confirm}
            onPress={() => void run(() => sync.createVault(passphrase))}>
            <Text>Create vault on this device</Text>
          </Button>
        </View>
      ) : null}

      {sync.mode === 'remote' && (remote === 'present' || remote === 'offline') ? (
        <View className="gap-3">
          <Text className="text-sm text-muted-foreground">
            A vault already exists. Enter its passphrase to download it. The screens will switch to
            that journal.
          </Text>
          <Input
            value={passphrase}
            onChangeText={setPassphrase}
            secureTextEntry
            placeholder="Vault passphrase"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            disabled={busy || passphrase.length === 0}
            onPress={() => void run(() => sync.unlock(passphrase))}>
            <Text>Unlock and switch to this vault</Text>
          </Button>
        </View>
      ) : null}

      {sync.mode === 'local' && sync.status?.status !== 'ok' ? (
        <View className="gap-3">
          <Input
            value={passphrase}
            onChangeText={setPassphrase}
            secureTextEntry
            placeholder="Vault passphrase"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            disabled={busy || passphrase.length === 0}
            onPress={() => void run(() => sync.unlock(passphrase))}>
            <Text>Unlock</Text>
          </Button>
          {sync.status?.status === 'vault_reset' ? (
            <Button
              variant="destructive"
              disabled={busy || passphrase.length === 0}
              onPress={() => void run(() => sync.replaceWithRemoteVault(passphrase))}>
              <Text>Replace this journal with the new vault</Text>
            </Button>
          ) : null}
        </View>
      ) : null}

      {sync.mode === 'local' && sync.status?.status === 'ok' ? (
        <View className="flex-row gap-2">
          <Button variant="outline" disabled={busy} onPress={() => sync.lock()}>
            <View className="flex-row items-center gap-2">
              <Lock size={14} className="text-foreground" />
              <Text>Lock</Text>
            </View>
          </Button>
          <Button variant="outline" disabled={busy} onPress={() => void run(() => sync.syncNow())}>
            <View className="flex-row items-center gap-2">
              <RefreshCw size={14} className="text-foreground" />
              <Text>Sync now</Text>
            </View>
          </Button>
        </View>
      ) : null}

      {sync.mode === 'local' ? (
        <View className="gap-3 border-t border-border pt-3">
          <Text className="text-sm font-medium">Reset vault</Text>
          <Text className="text-sm text-muted-foreground">
            Retires the server log and uploads this device&apos;s journal under a new key. Other
            devices must join again.
          </Text>
          <Input
            value={resetPassphrase}
            onChangeText={setResetPassphrase}
            secureTextEntry
            placeholder="New passphrase"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            value={resetConfirm}
            onChangeText={setResetConfirm}
            secureTextEntry
            placeholder="Confirm new passphrase"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            variant="destructive"
            disabled={
              busy || resetPassphrase.length < MIN_PASSPHRASE || resetPassphrase !== resetConfirm
            }
            onPress={() => void run(() => sync.resetVault(resetPassphrase))}>
            <Text>Reset vault</Text>
          </Button>
        </View>
      ) : null}
      {busy ? <ActivityIndicator /> : null}
    </View>
  );
}

function LocalStatus() {
  const { status } = useEncryptedSync();
  if (!status) return <Text className="text-sm text-muted-foreground">On-device journal.</Text>;
  const pending = status.pending === 0 ? 'Nothing waiting.' : `${status.pending} waiting to sync.`;
  const headline =
    status.status === 'locked'
      ? 'Locked. You can keep editing. Sync waits for the passphrase.'
      : status.status === 'offline'
        ? `Offline. ${pending}`
        : status.status === 'vault_reset'
          ? 'Another device replaced this vault.'
          : status.status === 'error'
            ? (status.message ?? 'Sync failed.')
            : `Synced through seq ${status.cursor}. ${pending}`;
  return <Text className="text-sm text-muted-foreground">{headline}</Text>;
}
