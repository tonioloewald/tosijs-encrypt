# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Use Bun for everything (not node/npm/npx/jest/vitest/esbuild — see `.cursor/rules/`).

- `bun install` — install deps (`bun run latest` does a clean reinstall)
- `bun test` — run all tests
- `bun test src/encrypt.test.ts` / `bun test -t "pattern"` — run one file / tests matching a name
- `bun run typecheck` — `tsc --noEmit` (TypeScript 7, strict incl. `noUncheckedIndexedAccess`; `lib` includes `DOM` for Web Crypto/`atob`/`TextEncoder`, `types: ["bun"]` for tests)
- `bun run build` — wipes `dist/`, bundles `index.ts` with `bun build`, emits `.d.ts` via `tsc -p tsconfig.build.json`, then prints the gzipped size delta against `dist-sizes.json` (`bin/sizes.ts`; re-record with `bun bin/sizes.ts --record` when cutting a tag)

There is no linter configured. `dist/` is gitignored (built in CI from the tag).

## Architecture

Tiny zero-dependency library (published as `tosijs-encrypt`) wrapping the Web Crypto API. `index.ts` just re-exports `src/encrypt.ts`, which holds all code; tests live alongside in `src/encrypt.test.ts` using `bun:test`.

Public API: `generateKey()`, `encrypt(plaintext, key)`, `decrypt(ciphertext, key)`, and the `EncryptionKey` interface (`{ key: string }`, base64 raw AES key). `CryptoKey` is a deprecated alias kept for backward compatibility — don't remove it without a major version bump.

Key design points:
- **AES-256-GCM** with a fresh random 12-byte IV per `encrypt()` call. The output format is `base64(IV || ciphertext)`; `decrypt()` slices the first 12 bytes as the IV. Changing this wire format breaks previously encrypted data.
- Keys are stored as plain serializable objects (base64 strings) and re-imported via `crypto.subtle.importKey` on every call — no `CryptoKey` objects are cached.
- `encrypt` requires keys that decode to exactly 32 bytes (AES-256): `importKey` would otherwise silently accept 16/24-byte keys as AES-128/192. `decrypt` still accepts 16/24 (`LEGACY_DECRYPT_KEY_BYTES`) because 1.0.0 wrote data with them. Drop that only in 2.0.0. Key problems throw a specific `Invalid key: …`; everything else is caught and rethrown as a generic message (tampering, truncation and a wrong key are deliberately indistinguishable).
- Imported keys are non-extractable; only `generateKey` creates an exportable one, to hand back as base64.
- Importing the module has no side effects (a test enforces it).
- Tests decrypt fixed ciphertexts written by 1.0.0 (32-, 24- and 16-byte keys), pinning the wire format. They also execute the README Usage example and assert zero dependencies.
- Must run in secure contexts (HTTPS) in browsers; Node 20+ or Bun on the server.

## Production consumer: Snowfox

Snowfox uses this library in production to encrypt clients' cached data in IndexedDB. Datasets are huge, so caching is aggressive. Each key is generated as needed (`generateKey()`), stored only in the cloud, never persisted on the device, and fetched only after the user authenticates. So:
- Any change to key handling or the ciphertext format must keep existing caches readable, or degrade cleanly. For a cache, a failed decrypt can be treated as a miss and refetched, which is why format changes are low-risk there, but say so in the CHANGELOG.
- Throughput matters (large payloads): keep encrypt/decrypt linear, and don't add per-call work beyond the key import.
- The key only ever travels over TLS. For this flow the post-quantum exposure is the TLS key exchange, not this library. Hybrid key sharing (#3617) is for consumers that wrap keys or pass them between parties.
- Dependencies: zero is the default. `@noble/post-quantum` for hybrid key sharing (board #3617) is an owner-approved exception, to be removed when native X-Wing is available everywhere.

## Ecosystem practices

This repo follows the shared practices in `../tosijs-coding-practices` (start at its `README.md`; check `practices/rollouts.md` for standing rollouts).

- Work is tracked on the virta board (`virta brief`, `virta ls "project:tosijs-encrypt"`; https://virta.tosijs.net/host/#?virta.scope=tosijs-encrypt), not in a TODO.md.
- Review reports live in `reviews/` (repo root). Run `/pre-release-review` before tagging.
- Every release gets a `CHANGELOG.md` entry; `llms.txt` (hand-authored) changes whenever the API does.
- Publishing goes through the shared OIDC workflow (`.github/workflows/publish.yml`, an unchanged copy of the practices template; don't edit it locally). Run `bun ../tosijs-coding-practices/tools/release-doctor.ts` before any release.
- Not applicable: Prettier never touches markdown — this repo has no Prettier config or dependency.
