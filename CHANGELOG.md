# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [1.1.0]

### Changed

- **`encrypt` only accepts 32-byte (AES-256) keys.** Any other length throws
  `Invalid key: expected 32 bytes (AES-256), got N.`. 1.0.0 silently accepted 16- and 24-byte
  keys as AES-128/192, contrary to the AES-256 promise. Keys made by `generateKey()` were
  always 32 bytes and are unaffected.
- **`decrypt` still reads data encrypted under a 16- or 24-byte key by 1.0.0**, so nothing
  stored becomes unreadable. This is deprecated and will be removed in 2.0.0. To migrate,
  decrypt such data and re-encrypt it under a `generateKey()` key.
- Malformed keys get specific errors from both functions: `Invalid key: expected { key: string }.`
  and `Invalid key: not valid base64.`. Ciphertext failures (tampering, truncation, wrong key)
  still share one generic error.
- **Node.js 20+** (`engines`). Node 16 lacks the global Web Crypto `crypto` the library uses,
  so the previous `>=15` claim was never true. 18 and 19 are end-of-life and are no longer
  supported. Checked on Node 20.20.2 and 22.
- Keys are imported as non-extractable for each encrypt/decrypt.
- `typescript` is no longer a peer dependency. It was only ever needed to build the package.

### Removed

- The post-quantum algorithm check that ran on import. It never fired (wrong algorithm names
  and key usages), and a library shouldn't run crypto calls or log on import. Importing the
  module now has no side effects.

### Fixed

- The docs claimed the library was only safe for "non-quantum applications". AES-256-GCM is
  considered quantum-resistant. The risk is in how keys are shared (see the README).

The ciphertext format is unchanged (`base64(IV ‖ ciphertext)`), and every ciphertext written by
1.0.0 still decrypts. Tests pin real 1.0.0 ciphertexts under 32-, 24- and 16-byte keys.
Size: `dist/index.js` 942 B gzipped (1.0.0: 940 B).

## [1.0.0]

- Initial release: `generateKey`, `encrypt`, `decrypt` with AES-256-GCM and a fresh 12-byte IV
  per message.

[1.1.0]: https://github.com/tonioloewald/tosijs-encrypt/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/tonioloewald/tosijs-encrypt/releases/tag/v1.0.0
