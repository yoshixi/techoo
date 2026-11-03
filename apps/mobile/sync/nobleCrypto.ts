import { gcm } from '@noble/ciphers/aes.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';
import type { CryptoAdapter } from './types';

/** Default adapter. @noble works in Node and Hermes, which has no scrypt and no reliable WebCrypto. */
export function createNobleCrypto(): CryptoAdapter {
  return {
    randomBytes(length: number): Uint8Array {
      return randomBytes(length);
    },
    scrypt(password, salt, params) {
      return scryptAsync(password, salt, {
        N: params.N,
        r: params.r,
        p: params.p,
        dkLen: params.dkLen,
      });
    },
    async aesGcmEncrypt(key, nonce, plaintext, aad) {
      return gcm(key, nonce, aad).encrypt(plaintext);
    },
    async aesGcmDecrypt(key, nonce, ciphertext, aad) {
      return gcm(key, nonce, aad).decrypt(ciphertext);
    },
    async sha256(data) {
      return sha256(data);
    },
  };
}
