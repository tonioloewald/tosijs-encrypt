# tosijs-encrypt

A simple library for generating keys, encrypting, and decrypting strings.

It is a thin convenient wrapper around modern browser's `crypto.subtle` encryption
library (which is only available in an `https` context) and uses the `AES-GCM`
algorithm. (This will be swapped out for a **Quantum Resistent** algorithm when one
becaomes available in all modern browsers.)

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
  /** The base64-encoded key. */
  key: string
  /** The base64-encoded Initialization Vector (IV). */
  iv: string
}
```
