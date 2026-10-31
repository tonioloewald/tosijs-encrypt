# tosijs-encrypt

A simple, zero-dependency library for generating keys, encrypting, and decrypting strings using the Web Crypto API.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Zero dependencies** - Uses only the native Web Crypto API
- **TypeScript first** - Full type definitions included
- **AES-256-GCM** encryption - Industry standard authenticated encryption
- **Secure by default** - Fresh IV generated for each encryption (safe for multiple messages per key)
- **Async/await** - Non-blocking cryptographic operations
- **Simple API** - Just three functions: `generateKey`, `encrypt`, `decrypt`

## Requirements

- Modern browser with [SubtleCrypto support](https://caniuse.com/?search=SubtleCrypto) (all major browsers)
- **HTTPS context required** - The Web Crypto API is only available in secure contexts
- Node.js 20+ or Bun (with built-in Web Crypto support)

## Installation

```bash
npm install tosijs-encrypt
```

## Usage

```typescript
import { generateKey, encrypt, decrypt } from 'tosijs-encrypt'

// Generate a key once, use it for multiple messages
const key = await generateKey()

// Encrypt multiple messages with the same key (safe!)
const encrypted1 = await encrypt('first secret', key)
const encrypted2 = await encrypt('second secret', key)

// Decrypt
const decrypted1 = await decrypt(encrypted1, key)
const decrypted2 = await decrypt(encrypted2, key)
```

## API

### `generateKey(): Promise<EncryptionKey>`

Generates a new cryptographically secure AES-256-GCM key (32 random bytes).

```typescript
const key = await generateKey()
// { key: "base64-encoded-key" }
```

### `encrypt(plaintext: string, key: EncryptionKey): Promise<string>`

Encrypts a plaintext string. A fresh random IV is generated for each call and embedded in the output.
Throws `Invalid key: …` if the key isn't base64 that decodes to exactly 32 bytes.

```typescript
const encrypted = await encrypt('secret message', key)
// Returns base64-encoded (IV + ciphertext)
```

### `decrypt(ciphertext: string, key: EncryptionKey): Promise<string>`

Decrypts a base64-encoded ciphertext string. Throws `Invalid key: …` for a malformed key, and a
generic error if the ciphertext was tampered with, truncated, or encrypted with a different key.
It also accepts the 16- and 24-byte keys 1.0.0 allowed (see Upgrading).

```typescript
const decrypted = await decrypt(encrypted, key)
// Returns original plaintext
```

### `EncryptionKey` Interface

The key object returned by `generateKey()` can be easily serialized and stored:

```typescript
interface EncryptionKey {
  /** The base64-encoded AES-256 key (32 bytes once decoded) */
  key: string
}
```

## Upgrading from 1.0.0

Nothing changes if your keys came from `generateKey()`. If you supplied your own 16- or 24-byte
(AES-128/192) key, `encrypt` now rejects it, but `decrypt` still reads your existing data.
Decrypt it and re-encrypt under a `generateKey()` key before 2.0.0, which will only accept
32-byte keys. Node.js 20+ is now required. See the
[CHANGELOG](https://github.com/tonioloewald/tosijs-encrypt/blob/main/CHANGELOG.md).

## Security

- **AES-256-GCM** provides both confidentiality and authenticity (authenticated encryption)
- **AES-256 only** - `encrypt` requires a key that decodes to exactly 32 bytes; 16- and 24-byte keys (AES-128/192) are rejected rather than silently accepted (`decrypt` still reads data 1.0.0 wrote with them, until 2.0.0)
- **Unique IV per message** - Each `encrypt()` call generates a fresh 12-byte IV, making it safe to encrypt multiple messages with the same key
- **IV is not secret** - It's prepended to the ciphertext and extracted automatically during decryption
- **Store keys securely** - Never expose keys in client-side code or version control
- **HTTPS required** - The Web Crypto API only works in secure contexts

## Quantum resistance

AES-256 is considered safe against known quantum attacks: Grover's algorithm halves its effective
strength to about 128 bits. The quantum risk lies in **how you share keys**. Wrapping a key with
RSA or ECDH, or deriving it from a weak password, exposes it to harvest-now-decrypt-later attacks.
Hybrid post-quantum key sharing (X-Wing) is being considered for a future version.

## References

- [SubtleCrypto documentation (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)
- [Browser support for SubtleCrypto](https://caniuse.com/?search=SubtleCrypto)
- [Comparing Quantum-Resistant Cryptographic Algorithms](https://dl.acm.org/doi/10.1145/3745812.3745888)

## License

MIT
