# tosijs-encrypt

A simple library for generating keys, encrypting, and decrypting strings.

It is a thin convenient wrapper around modern browser's `crypto.subtle` encryption
library (which is only available in an `https` context) and uses the `AES-GCM`
algorithm. (The default will be changed to a **Quantum Resistent** algorithm when one
becomes available in all modern browsers.)

- [SubtleCrypto documentation](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)
- [Browser support for SubtleCrypto](https://caniuse.com/?search=SubtleCrypto)
- [Comparing Quantum-Resistant Cryptographic Algorithms…](https://dl.acm.org/doi/10.1145/3745812.3745888)

## Usage

```
import { generateKey } from 'tosijs-encrypt'

(async () => {
  const key = await generateKey()
  const plainText = 'imagine this is important'
  const encryptedText = await encrypt(plainText, key)
  const decryptedText = await decrypt(encryptedText, key)
})()
```

## Keys

The key is a simple object that can easily be serialized and stored.

```
export interface CryptoKey {
  /** The base64-encoded exported raw key. */
  key: string
  /** The base64-encoded Initialization Vector (IV). */
  iv: string
}
```
