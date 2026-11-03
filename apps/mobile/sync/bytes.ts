const TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function utf8Encode(value: string): Uint8Array {
  return encoder.encode(value);
}

export function utf8Decode(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) {
    throw new Error('invalid hex');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Standard base64 with padding and no whitespace (RFC 4648). */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = i + 1 < bytes.length ? (bytes[i + 1] ?? 0) : 0;
    const b2 = i + 2 < bytes.length ? (bytes[i + 2] ?? 0) : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += TABLE[(triple >> 18) & 63];
    out += TABLE[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? TABLE[(triple >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? TABLE[triple & 63] : '=';
  }
  return out;
}

export function base64ToBytes(value: string): Uint8Array {
  if (value.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(value)) {
    throw new Error('invalid base64');
  }
  const pad = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((value.length / 4) * 3 - pad);
  let offset = 0;
  for (let i = 0; i < value.length; i += 4) {
    const c0 = TABLE.indexOf(value[i] ?? '');
    const c1 = TABLE.indexOf(value[i + 1] ?? '');
    const c2 = value[i + 2] === '=' ? 0 : TABLE.indexOf(value[i + 2] ?? '');
    const c3 = value[i + 3] === '=' ? 0 : TABLE.indexOf(value[i + 3] ?? '');
    if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) throw new Error('invalid base64');
    const triple = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    out[offset] = (triple >> 16) & 255;
    offset += 1;
    if (value[i + 2] !== '=') {
      out[offset] = (triple >> 8) & 255;
      offset += 1;
    }
    if (value[i + 3] !== '=') {
      out[offset] = triple & 255;
      offset += 1;
    }
  }
  return out;
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** NFKC so composed and decomposed passphrases derive the same key. */
export function passphraseBytes(passphrase: string): Uint8Array {
  return utf8Encode(passphrase.normalize('NFKC'));
}
