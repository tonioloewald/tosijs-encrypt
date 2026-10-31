/**
 * @file Key generation and string encryption/decryption with AES-256-GCM, using only the
 * Web Crypto API. All functions are asynchronous so they never block the main thread.
 *
 * AES-256 is considered safe against known quantum attacks: Grover's algorithm halves its
 * effective strength to about 128 bits. The quantum risk lies in how keys are exchanged
 * (RSA/ECDH key wrapping), which is outside what this library does today.
 */

/**
 * An interface representing an encryption key.
 */
export interface EncryptionKey {
  /** The base64-encoded AES-256 key (32 bytes once decoded). */
  key: string
}

/**
 * @deprecated Use EncryptionKey instead. This alias exists for backward compatibility.
 */
export type CryptoKey = EncryptionKey

/** AES-256 key length in bytes. encrypt() accepts nothing else. */
const KEY_BYTES = 32

/**
 * Key lengths decrypt() still accepts. 1.0.0 silently accepted AES-128/192 keys, so data a
 * caller encrypted under their own short key must stay readable; nothing new is written with
 * one. Becomes [KEY_BYTES] in 2.0.0.
 */
const LEGACY_DECRYPT_KEY_BYTES: readonly number[] = [16, 24, KEY_BYTES]

/** AES-GCM IV length in bytes, prepended to every ciphertext. */
const IV_BYTES = 12

/**
 * Converts a Base64 string to bytes.
 * @param base64String The Base64 encoded string.
 * @returns The decoded bytes.
 */
function base64ToBytes(base64String: string): Uint8Array<ArrayBuffer> {
  const binaryString = atob(base64String)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * Converts bytes to a Base64 string.
 * @param buffer The bytes to encode.
 * @returns The resulting Base64 string.
 */
function bytesToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binaryString = ''
  for (const byte of bytes) {
    binaryString += String.fromCharCode(byte)
  }
  return btoa(binaryString)
}

/**
 * Decodes and validates an EncryptionKey's raw bytes.
 * Throws a descriptive error (it reveals nothing secret) rather than the generic one, so a
 * caller passing the wrong kind of key can tell why it failed.
 */
function keyBytes(
  encryptionKey: EncryptionKey,
  allowedLengths: readonly number[] = [KEY_BYTES]
): Uint8Array<ArrayBuffer> {
  if (typeof encryptionKey?.key !== 'string') {
    throw new Error('Invalid key: expected { key: string }.')
  }
  let bytes: Uint8Array<ArrayBuffer>
  try {
    bytes = base64ToBytes(encryptionKey.key)
  } catch {
    throw new Error('Invalid key: not valid base64.')
  }
  if (!allowedLengths.includes(bytes.length)) {
    throw new Error(
      `Invalid key: expected ${KEY_BYTES} bytes (AES-256), got ${bytes.length}.`
    )
  }
  return bytes
}

/**
 * Imports raw key bytes as a non-extractable AES-GCM key for a single usage.
 */
function importKey(
  bytes: Uint8Array<ArrayBuffer>,
  usage: 'encrypt' | 'decrypt'
): Promise<globalThis.CryptoKey> {
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, [usage])
}

/**
 * Generates a new cryptographically secure AES-256-GCM key.
 * @returns A promise that resolves to an EncryptionKey object containing the base64-encoded key.
 */
export async function generateKey(): Promise<EncryptionKey> {
  try {
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: KEY_BYTES * 8 },
      true, // exportable: the caller stores the key as base64
      ['encrypt', 'decrypt']
    )
    const exportedKey = await crypto.subtle.exportKey('raw', key)
    return { key: bytesToBase64(exportedKey) }
  } catch {
    throw new Error('Failed to generate cryptographic key.')
  }
}

/**
 * Encrypts a plaintext string using a provided EncryptionKey.
 * A fresh random IV is generated for each encryption and prepended to the ciphertext.
 * @param plaintext The string to encrypt.
 * @param encryptionKey The EncryptionKey object containing the base64-encoded key.
 * @returns A promise that resolves to the base64-encoded IV+ciphertext.
 * @throws If the key is not a base64-encoded 32-byte key, or encryption fails.
 */
export async function encrypt(
  plaintext: string,
  encryptionKey: EncryptionKey
): Promise<string> {
  const rawKey = keyBytes(encryptionKey)
  try {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
    const key = await importKey(rawKey, 'encrypt')
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext)
    )

    // IV ‖ ciphertext (the ciphertext carries GCM's 16-byte auth tag at its end)
    const combined = new Uint8Array(IV_BYTES + ciphertext.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(ciphertext), IV_BYTES)
    return bytesToBase64(combined)
  } catch {
    throw new Error('Failed to encrypt the message.')
  }
}

/**
 * Decrypts a base64-encoded ciphertext string using a provided EncryptionKey.
 * Extracts the IV from the first 12 bytes of the decoded data.
 * @param ciphertextBase64 The base64-encoded IV+ciphertext to decrypt.
 * @param encryptionKey The EncryptionKey object containing the base64-encoded key.
 * @returns A promise that resolves to the decrypted plaintext string.
 * Also accepts 16- and 24-byte keys, so data encrypted under them by 1.0.0 stays readable
 * (deprecated: re-encrypt it under a generateKey() key; 2.0.0 will accept only 32 bytes).
 * @throws If the key is malformed, or the ciphertext is malformed, tampered with, or was
 *   encrypted with a different key.
 */
export async function decrypt(
  ciphertextBase64: string,
  encryptionKey: EncryptionKey
): Promise<string> {
  const rawKey = keyBytes(encryptionKey, LEGACY_DECRYPT_KEY_BYTES)
  try {
    const combined = base64ToBytes(ciphertextBase64)
    const iv = combined.slice(0, IV_BYTES)
    const ciphertext = combined.slice(IV_BYTES)

    const key = await importKey(rawKey, 'decrypt')
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return new TextDecoder().decode(decrypted)
  } catch {
    throw new Error('Failed to decrypt the message. Check the key.')
  }
}
