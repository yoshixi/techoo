import {
  getApiV1Sync,
  getApiV1SyncOps,
  getApiV1Vault,
  postApiV1SyncOps,
  postApiV1VaultReset,
  putApiV1Vault,
} from '@/gen/api/endpoints/techooAPI.gen';
import { isApiRequestError } from '@/lib/api/ApiRequestError';
import { withSilentApiErrors } from '@/lib/api/mutator';
import { SyncError, isOfflineError, type SyncTransport, type VaultMaterial } from '@/sync';

type VaultBody = {
  vaultId: string;
  salt: string;
  kdf: 'scrypt';
  kdfParams: VaultMaterial['kdfParams'];
  wrappedKey: string;
  wrappedKeyNonce: string;
  headSeq: number;
  headHash: string;
};

function asVault(body: VaultBody): VaultMaterial {
  return {
    vaultId: body.vaultId,
    salt: body.salt,
    kdf: 'scrypt',
    kdfParams: body.kdfParams,
    wrappedKey: body.wrappedKey,
    wrappedKeyNonce: body.wrappedKeyNonce,
    headSeq: body.headSeq,
    headHash: body.headHash,
  };
}

function mapError(err: unknown): Error {
  if (err instanceof SyncError) return err;
  if (isApiRequestError(err)) {
    let code: string | undefined;
    if (err.body) {
      try {
        code = (JSON.parse(err.body) as { code?: string }).code;
      } catch {
        code = undefined;
      }
    }
    if (code === 'vault_reset') return new SyncError('vault_reset', 'Vault was reset');
    if (code === 'vault_exists') return new SyncError('vault_exists', 'Vault exists');
    if (code === 'vault_not_found' || err.status === 404)
      return new SyncError('vault_not_found', 'No vault');
    return new SyncError('http', `HTTP ${err.status}`);
  }
  if (isOfflineError(err)) return new SyncError('offline', 'Network unavailable');
  return err instanceof Error ? err : new SyncError('error', 'Sync request failed');
}

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await withSilentApiErrors(fn);
  } catch (err) {
    throw mapError(err);
  }
}

export function createApiTransport(): SyncTransport {
  return {
    async putVault(body) {
      return asVault(await call(() => putApiV1Vault(body)));
    },
    async getVault() {
      try {
        return asVault(await call(() => getApiV1Vault()));
      } catch (err) {
        if (err instanceof SyncError && err.code === 'vault_not_found') return null;
        throw err;
      }
    },
    async resetVault(body) {
      return asVault(await call(() => postApiV1VaultReset(body)));
    },
    async getHead() {
      try {
        return await call(() => getApiV1Sync());
      } catch (err) {
        if (err instanceof SyncError && err.code === 'vault_not_found') return null;
        throw err;
      }
    },
    async pushOps(body) {
      return call(() => postApiV1SyncOps(body));
    },
    async pullOps(query) {
      return call(() => getApiV1SyncOps(query));
    },
  };
}
