import { test, expect, describe, spyOn } from 'bun:test'
import { generateKey, encrypt, decrypt, type EncryptionKey } from './encrypt'

describe('generateKey', () => {
  test('generates a valid key object', async () => {
    const key = await generateKey()

    expect(key).toBeTruthy()
    expect(key.key).toBeTruthy()
    expect(typeof key.key).toBe('string')
  })

  test('generates unique keys each time', async () => {
    const key1 = await generateKey()
    const key2 = await generateKey()

    expect(key1.key).not.toBe(key2.key)
  })

  test('generates keys with correct base64 format', async () => {
    const key = await generateKey()

    // Base64 should not throw when decoded
    expect(() => atob(key.key)).not.toThrow()

    // AES-256 key is 32 bytes, base64 encoded
    const keyBytes = atob(key.key)
    expect(keyBytes.length).toBe(32)
  })

  test('key object does not contain IV (IV is per-message)', async () => {
    const key = await generateKey()

    expect('iv' in key).toBe(false)
  })
})

describe('encrypt', () => {
  test('encrypts plaintext to different ciphertext', async () => {
    const key = await generateKey()
    const plainText = 'Hello, World!'
    const encrypted = await encrypt(plainText, key)

    expect(encrypted).toBeTruthy()
    expect(encrypted).not.toBe(plainText)
  })

  test('produces valid base64 output', async () => {
    const key = await generateKey()
    const encrypted = await encrypt('test message', key)

    expect(() => atob(encrypted)).not.toThrow()
  })

  test('encrypts empty string', async () => {
    const key = await generateKey()
    const encrypted = await encrypt('', key)

    expect(encrypted).toBeTruthy()
  })

  test('encrypts unicode characters', async () => {
    const key = await generateKey()
    const plainText = 'Hello 🌍 世界'
    const encrypted = await encrypt(plainText, key)
    const decrypted = await decrypt(encrypted, key)

    expect(decrypted).toBe(plainText)
  })

  test('same plaintext produces different ciphertext each time (unique IV)', async () => {
    const key = await generateKey()
    const plainText = 'same message'

    const encrypted1 = await encrypt(plainText, key)
    const encrypted2 = await encrypt(plainText, key)
    const encrypted3 = await encrypt(plainText, key)

    // All should be different due to unique IVs
    expect(encrypted1).not.toBe(encrypted2)
    expect(encrypted2).not.toBe(encrypted3)
    expect(encrypted1).not.toBe(encrypted3)

    // But all should decrypt to the same plaintext
    expect(await decrypt(encrypted1, key)).toBe(plainText)
    expect(await decrypt(encrypted2, key)).toBe(plainText)
    expect(await decrypt(encrypted3, key)).toBe(plainText)
  })

  test('output contains 12-byte IV prefix', async () => {
    const key = await generateKey()
    const encrypted = await encrypt('test', key)
    const decoded = atob(encrypted)

    // Should be at least 12 bytes (IV) + some ciphertext
    expect(decoded.length).toBeGreaterThan(12)
  })
})

describe('decrypt', () => {
  test('decrypts to original plaintext', async () => {
    const key = await generateKey()
    const plainText = 'Mr Watson I need you'
    const encrypted = await encrypt(plainText, key)
    const decrypted = await decrypt(encrypted, key)

    expect(decrypted).toBe(plainText)
  })

  test('decrypts empty string', async () => {
    const key = await generateKey()
    const encrypted = await encrypt('', key)
    const decrypted = await decrypt(encrypted, key)

    expect(decrypted).toBe('')
  })

  test('decrypts long text', async () => {
    const key = await generateKey()
    const plainText = 'a'.repeat(10000)
    const encrypted = await encrypt(plainText, key)
    const decrypted = await decrypt(encrypted, key)

    expect(decrypted).toBe(plainText)
  })

  test('fails with wrong key', async () => {
    const key1 = await generateKey()
    const key2 = await generateKey()
    const encrypted = await encrypt('secret', key1)

    await expect(decrypt(encrypted, key2)).rejects.toThrow()
  })

  test('fails with tampered ciphertext', async () => {
    const key = await generateKey()
    const encrypted = await encrypt('secret', key)

    // Tamper with the ciphertext
    const tampered = encrypted.slice(0, -4) + 'XXXX'

    await expect(decrypt(tampered, key)).rejects.toThrow()
  })

  test('fails with truncated data', async () => {
    const key = await generateKey()
    const encrypted = await encrypt('secret', key)

    // Truncate to less than IV size
    const truncated = encrypted.slice(0, 8)

    await expect(decrypt(truncated, key)).rejects.toThrow()
  })
})

describe('round-trip', () => {
  test('handles special characters', async () => {
    const key = await generateKey()
    const testCases = [
      'simple text',
      '12345',
      '!@#$%^&*()',
      'line1\nline2\ttab',
      '"quotes" and \'apostrophes\'',
      '<html>&amp;</html>',
    ]

    for (const plainText of testCases) {
      const encrypted = await encrypt(plainText, key)
      const decrypted = await decrypt(encrypted, key)
      expect(decrypted).toBe(plainText)
    }
  })

  test('multiple messages with same key', async () => {
    const key = await generateKey()

    // This is now safe - each encrypt() uses a unique IV
    const messages = [
      'First message',
      'Second message',
      'Third message',
      'Fourth message',
    ]

    const encrypted = await Promise.all(
      messages.map((msg) => encrypt(msg, key))
    )

    const decrypted = await Promise.all(
      encrypted.map((enc) => decrypt(enc, key))
    )

    expect(decrypted).toEqual(messages)
  })
})

describe('key validation', () => {
  // AES-GCM's importKey accepts 16/24/32-byte keys; anything but 32 would silently be
  // AES-128/192, breaking the AES-256 promise (about 64-bit against Grover for AES-128).
  const keyOf = (bytes: number): EncryptionKey => ({
    key: btoa(String.fromCharCode(...new Uint8Array(bytes).fill(7))),
  })

  for (const bytes of [16, 24, 31, 33, 0]) {
    test(`encrypt rejects a ${bytes}-byte key`, async () => {
      await expect(encrypt('x', keyOf(bytes))).rejects.toThrow(
        `Invalid key: expected 32 bytes (AES-256), got ${bytes}.`
      )
    })

    test(`decrypt rejects a ${bytes}-byte key`, async () => {
      const ciphertext = await encrypt('x', await generateKey())
      await expect(decrypt(ciphertext, keyOf(bytes))).rejects.toThrow(
        `Invalid key: expected 32 bytes (AES-256), got ${bytes}.`
      )
    })
  }

  test('rejects a key that is not base64', async () => {
    await expect(encrypt('x', { key: 'not base64!' })).rejects.toThrow(
      'Invalid key: not valid base64.'
    )
    await expect(decrypt('AAAA', { key: 'not base64!' })).rejects.toThrow(
      'Invalid key: not valid base64.'
    )
  })
})

describe('compatibility', () => {
  test('decrypts a ciphertext written by tosijs-encrypt 1.0.0 (wire format is base64(IV ‖ ciphertext))', async () => {
    const key = { key: 'vAXoO4PkK3oruhCCSpK1ZZBG8lX/1N1bY7v0Oy78umM=' }
    const ciphertext =
      'uA++JLWe7jYga2RUe5Ljdq1Xyr68rgOVTLMyizqIuPIPNRwFlyeIys5O+QNkD5+gEwcy4kGrHZSksBnOEBdolFuLsQ3lQquWJePS'

    expect(await decrypt(ciphertext, key)).toBe('written by tosijs-encrypt 1.0.0 — héllo 🌍')
  })
})

describe('module', () => {
  test('importing it has no side effects (no crypto calls, no console output)', async () => {
    const generate = spyOn(crypto.subtle, 'generateKey')
    const warn = spyOn(console, 'warn')
    try {
      await import(`./encrypt.ts?fresh=${Date.now()}`)
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(generate).not.toHaveBeenCalled()
      expect(warn).not.toHaveBeenCalled()
    } finally {
      generate.mockRestore()
      warn.mockRestore()
    }
  })
})
