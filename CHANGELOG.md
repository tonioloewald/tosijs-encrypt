# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [1.1.0]

### Changed

- **Keys must be exactly 32 bytes (AES-256).** `encrypt` and `decrypt` now throw
  `Invalid key: expected 32 bytes (AES-256), got N.` for any other length, and
  `Invalid key: not valid base64.` for a key that doesn't decode. 1.0.0 silently accepted
  16- and 24-byte keys as AES-128/192, contrary to the AES-256 promise. Keys made by
  `generateKey()` were always 32 bytes and are unaffected. 1.0.0 is affected.
- **Node.js 20+** (`engines`). The library uses the global Web Crypto `crypto`, which Node 16
  lacks. The previous `>=15` claim was never true.
- Keys are imported as non-extractable for each encrypt/decrypt.
- `typescript` is no longer a peer dependency. It was only ever needed to build the package.

### Removed

- The post-quantum algorithm check that ran on import. It never fired (wrong algorithm names
  and key usages), and a library shouldn't run crypto calls or log on import. Importing the
  module now has no side effects.

### Fixed

- The docs claimed the library was only safe for "non-quantum applications". AES-256-GCM is
  considered quantum-resistant. The risk is in how keys are shared (see the README).

Ciphertexts written by 1.0.0 still decrypt (the format is unchanged: `base64(IV ‖ ciphertext)`).
Size: `dist/index.js` 856 B gzipped, down from 940 B in 1.0.0.

## [1.0.0]

- Initial release: `generateKey`, `encrypt`, `decrypt` with AES-256-GCM and a fresh 12-byte IV
  per message.

[1.1.0]: https://github.com/tonioloewald/tosijs-encrypt/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/tonioloewald/tosijs-encrypt/releases/tag/v1.0.0
