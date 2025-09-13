/**
 * @file A simple cryptographically secure library for key generation and string encryption/decryption.
 * This library uses the Web Crypto API, which is secure for modern, non-quantum applications.
 * All functions are asynchronous to prevent blocking the main thread.
 *
 * Note: The Web Crypto API does not yet support quantum-resistant algorithms. AES-GCM is used here
 * as the industry standard for symmetric encryption.
 */

/**
 * An interface representing a key pair containing the symmetric key and a random Initialization Vector (IV).
 */
export interface CryptoKey {
  /** The base64-encoded key. */
  key: string
  /** The base64-encoded Initialization Vector (IV). */
  iv: string
}

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
 * Generates a new cryptographically secure AES-GCM key and a random IV.
 * @returns A promise that resolves to a CryptoKey object containing the base64-encoded key and IV.
 */
export async function generateKey(): Promise<CryptoKey> {
  try {
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, // Key is exportable
      ['encrypt', 'decrypt']
    )
    const exportedKey = await crypto.subtle.exportKey('raw', key)
    const keyBase64 = arrayBufferToBase64(exportedKey)

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ivBase64 = arrayBufferToBase64(iv.buffer)

    return { key: keyBase64, iv: ivBase64 }
  } catch (error) {
    console.error('Error generating key:', error)
    throw new Error('Failed to generate cryptographic key.')
  }
}

/**
 * Encrypts a plaintext string using a provided CryptoKey.
 * @param plaintext The string to encrypt.
 * @param keyPair The CryptoKey object containing the base64-encoded key and IV.
 * @returns A promise that resolves to the base64-encoded ciphertext.
 */
export async function encrypt(
  plaintext: string,
  keyPair: CryptoKey
): Promise<string> {
  try {
    const keyBuffer = base64ToArrayBuffer(keyPair.key)
    const ivBuffer = base64ToArrayBuffer(keyPair.iv)

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
      { name: 'AES-GCM', iv: ivBuffer },
      key,
      plaintextBuffer
    )

    return arrayBufferToBase64(ciphertextBuffer)
  } catch (error) {
    console.error('Error encrypting:', error)
    throw new Error('Failed to encrypt the message.')
  }
}

/**
 * Decrypts a base64-encoded ciphertext string using a provided CryptoKey.
 * @param ciphertextBase64 The base64-encoded ciphertext to decrypt.
 * @param keyPair The CryptoKey object containing the base64-encoded key and IV.
 * @returns A promise that resolves to the decrypted plaintext string.
 */
export async function decrypt(
  ciphertextBase64: string,
  keyPair: CryptoKey
): Promise<string> {
  try {
    const keyBuffer = base64ToArrayBuffer(keyPair.key)
    const ivBuffer = base64ToArrayBuffer(keyPair.iv)
    const ciphertextBuffer = base64ToArrayBuffer(ciphertextBase64)

    const key = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      true,
      ['decrypt']
    )
    const textDecoder = new TextDecoder()
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuffer },
      key,
      ciphertextBuffer
    )

    return textDecoder.decode(decryptedBuffer)
  } catch (error) {
    console.error('Error decrypting:', error)
    throw new Error('Failed to decrypt the message. Check the key and IV.')
  }
}
