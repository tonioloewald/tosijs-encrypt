import { test, expect, describe, spyOn } from 'bun:test'
import { generateKey, encrypt, decrypt, type EncryptionKey } from './encrypt'

// Wrong key, tampering and truncation must be indistinguishable (no error oracle).
const DECRYPT_FAILED = 'Failed to decrypt the message. Check the key.'

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

    await expect(decrypt(encrypted, key2)).rejects.toThrow(DECRYPT_FAILED)
  })

  test('fails with tampered ciphertext', async () => {
    const key = await generateKey()
    const encrypted = await encrypt('secret', key)

    // Tamper with the ciphertext
    const tampered = encrypted.slice(0, -4) + 'XXXX'

    await expect(decrypt(tampered, key)).rejects.toThrow(DECRYPT_FAILED)
  })

  test('fails with truncated data', async () => {
    const key = await generateKey()
    const encrypted = await encrypt('secret', key)

    // Truncate to less than IV size
    const truncated = encrypted.slice(0, 8)

    await expect(decrypt(truncated, key)).rejects.toThrow(DECRYPT_FAILED)
  })

  test('fails the same way for empty and IV-only ciphertext', async () => {
    const key = await generateKey()

    await expect(decrypt('', key)).rejects.toThrow(DECRYPT_FAILED)
    await expect(decrypt(btoa('x'.repeat(12)), key)).rejects.toThrow(DECRYPT_FAILED)
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
  }

  // decrypt keeps reading 1.0.0's AES-128/192 data (see the compatibility tests)
  for (const bytes of [31, 33, 0, 8]) {
    test(`decrypt rejects a ${bytes}-byte key`, async () => {
      const ciphertext = await encrypt('x', await generateKey())
      await expect(decrypt(ciphertext, keyOf(bytes))).rejects.toThrow(
        `Invalid key: expected 32 bytes (AES-256), got ${bytes}.`
      )
    })
  }

  test('rejects a missing or non-string key', async () => {
    for (const bad of [undefined, null, {}, { key: 123 }]) {
      await expect(encrypt('x', bad as unknown as EncryptionKey)).rejects.toThrow(
        'Invalid key: expected { key: string }.'
      )
      await expect(decrypt('AAAA', bad as unknown as EncryptionKey)).rejects.toThrow(
        'Invalid key: expected { key: string }.'
      )
    }
  })

  test('imports keys as non-extractable', async () => {
    const importKey = spyOn(crypto.subtle, 'importKey')
    try {
      const key = await generateKey()
      await decrypt(await encrypt('x', key), key)
      expect(importKey).toHaveBeenCalledTimes(2)
      for (const call of importKey.mock.calls) expect(call[3]).toBe(false)
    } finally {
      importKey.mockRestore()
    }
  })

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

  // 1.0.0 accepted caller-supplied AES-128/192 keys; their data must stay readable in 1.x,
  // while encrypt refuses to write anything new with them.
  const legacy = [
    {
      bytes: 16,
      key: { key: 'YZuiQWtm0G4oboFWljTx/w==' },
      ciphertext: 'SyVSLCTWF+IozIiiaMaU3zF2qB1RFL5D+qLosY/Gkt/uvM7lHDA9CakT6BJdH9T4MY21crTP6xJnKQ==',
    },
    {
      bytes: 24,
      key: { key: 'XMRySCPXOiW/hBUNJLRwoWh7iYSpTbHE' },
      ciphertext: 'g1NXgNMVWhNpIN2+cox+Gfsf4qqpa20Sy/wJzcb8VTYHdDqG0HR3lXUW8gG4KnhrmSqPJFoucvDNAA==',
    },
  ]
  for (const { bytes, key, ciphertext } of legacy) {
    test(`decrypts 1.0.0 data under a ${bytes}-byte key, but won't encrypt with one`, async () => {
      expect(await decrypt(ciphertext, key)).toBe(`legacy AES-${bytes * 8} data from 1.0.0`)
      await expect(encrypt('x', key)).rejects.toThrow(
        `Invalid key: expected 32 bytes (AES-256), got ${bytes}.`
      )
    })
  }
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

describe('package', () => {
  test('stays zero-dependency', async () => {
    const pkg = await Bun.file(new URL('../package.json', import.meta.url)).json()
    expect(pkg.dependencies ?? {}).toEqual({})
    expect(pkg.peerDependencies ?? {}).toEqual({})
  })

  test('the README usage example runs as written', async () => {
    const readme = await Bun.file(new URL('../README.md', import.meta.url)).text()
    const usage = readme.split('## Usage')[1]?.match(/```typescript\n([\s\S]*?)```/)?.[1]
    expect(usage).toBeTruthy()

    const body = usage!.replace(/^import .*$/m, '') +
      '\nreturn { decrypted1, decrypted2 }'
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
    const run = new AsyncFunction('generateKey', 'encrypt', 'decrypt', body)
    expect(await run(generateKey, encrypt, decrypt)).toEqual({
      decrypted1: 'first secret',
      decrypted2: 'second secret',
    })
  })
})
