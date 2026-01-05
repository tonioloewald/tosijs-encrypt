/**
 * @file A simple cryptographically secure library for key generation and string encryption/decryption.
 * This library uses the Web Crypto API, which is secure for modern, non-quantum applications.
 * All functions are asynchronous to prevent blocking the main thread.
 *
 * Note: The Web Crypto API does not yet support quantum-resistant algorithms. AES-GCM is used here
 * as the industry standard for symmetric encryption.
 */

// Check for post-quantum algorithm support on module load
;(async () => {
  const algorithms = ['ML-KEM', 'ML-DSA', 'SLH-DSA', 'X25519Kyber768']
  for (const algorithm of algorithms) {
    try {
      await crypto.subtle.generateKey(
        { name: algorithm } as Algorithm,
        false,
        ['encrypt', 'decrypt']
      )
      console.warn(
        `[tosijs-encrypt] Post-quantum algorithm "${algorithm}" is now available in this browser. ` +
        `Consider updating tosijs-encrypt to a newer version with quantum-resistant encryption.`
      )
      return
    } catch {
      // Expected - algorithm not supported yet
    }
  }
})()

/**
 * An interface representing an encryption key.
 */
export interface EncryptionKey {
  /** The base64-encoded AES-256 key. */
  key: string
}

/**
 * @deprecated Use EncryptionKey instead. This alias exists for backward compatibility.
 */
export type CryptoKey = EncryptionKey

/**
 * Converts a Base64 string to an ArrayBuffer.
 * @param base64String The Base64 encoded string.
 * @returns The resulting ArrayBuffer.
 */
function base64ToArrayBuffer(base64String: string): ArrayBuffer {
  const binaryString = atob(base64String)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Converts an ArrayBuffer to a Base64 string.
 * @param arrayBuffer The ArrayBuffer to encode.
 * @returns The resulting Base64 string.
 */
function arrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer)
  let binaryString = ''
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i])
  }
  return btoa(binaryString)
}

/**
 * Generates a new cryptographically secure AES-GCM key.
 * @returns A promise that resolves to an EncryptionKey object containing the base64-encoded key.
 */
export async function generateKey(): Promise<EncryptionKey> {
  try {
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, // Key is exportable
      ['encrypt', 'decrypt']
    )
    const exportedKey = await crypto.subtle.exportKey('raw', key)
    const keyBase64 = arrayBufferToBase64(exportedKey)

    return { key: keyBase64 }
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
 */
export async function encrypt(
  plaintext: string,
  encryptionKey: EncryptionKey
): Promise<string> {
  try {
    const keyBuffer = base64ToArrayBuffer(encryptionKey.key)

    // Generate a fresh IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const key = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      true,
      ['encrypt']
    )
    const textEncoder = new TextEncoder()
    const plaintextBuffer = textEncoder.encode(plaintext)

    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintextBuffer
    )

    // Combine IV + ciphertext into a single buffer
    const combined = new Uint8Array(iv.length + ciphertextBuffer.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(ciphertextBuffer), iv.length)

    return arrayBufferToBase64(combined.buffer)
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
 */
export async function decrypt(
  ciphertextBase64: string,
  encryptionKey: EncryptionKey
): Promise<string> {
  try {
    const keyBuffer = base64ToArrayBuffer(encryptionKey.key)
    const combined = new Uint8Array(base64ToArrayBuffer(ciphertextBase64))

    // Extract IV (first 12 bytes) and ciphertext (rest)
    const iv = combined.slice(0, 12)
    const ciphertext = combined.slice(12)

    const key = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      true,
      ['decrypt']
    )
    const textDecoder = new TextDecoder()
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    )

    return textDecoder.decode(decryptedBuffer)
  } catch {
    throw new Error('Failed to decrypt the message. Check the key.')
  }
}
