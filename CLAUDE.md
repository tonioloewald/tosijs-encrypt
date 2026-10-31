# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Use Bun for everything (not node/npm/npx/jest/vitest/esbuild — see `.cursor/rules/`).

- `bun install` — install deps (`bun run latest` does a clean reinstall)
- `bun test` — run all tests
- `bun test src/encrypt.test.ts` / `bun test -t "pattern"` — run one file / tests matching a name
- `bun run build` — bundles `index.ts` to `dist/` with `bun build`, then emits `.d.ts` via `tsc`
- `prepublishOnly` runs tests then build

There is no linter configured. `tsconfig.json` is strict (`noUncheckedIndexedAccess` etc.) with `noEmit`; type-check with `bunx tsc --noEmit`.

## Architecture

Tiny zero-dependency library (published as `tosijs-encrypt`) wrapping the Web Crypto API. `index.ts` just re-exports `src/encrypt.ts`, which holds all code; tests live alongside in `src/encrypt.test.ts` using `bun:test`.

Public API: `generateKey()`, `encrypt(plaintext, key)`, `decrypt(ciphertext, key)`, and the `EncryptionKey` interface (`{ key: string }`, base64 raw AES key). `CryptoKey` is a deprecated alias kept for backward compatibility — don't remove it without a major version bump.

Key design points:
- **AES-256-GCM** with a fresh random 12-byte IV per `encrypt()` call. The output format is `base64(IV || ciphertext)`; `decrypt()` slices the first 12 bytes as the IV. Changing this wire format breaks previously encrypted data.
- Keys are stored as plain serializable objects (base64 strings) and re-imported via `crypto.subtle.importKey` on every call — no `CryptoKey` objects are cached.
- All errors are caught and rethrown as generic messages (intentionally not leaking crypto details).
- On module load, an IIFE probes for post-quantum algorithms (`ML-KEM`, etc.) and `console.warn`s if one is available. The README states the default algorithm will move to a quantum-resistant one once broadly supported in browsers.
- Must run in secure contexts (HTTPS) in browsers; Node 15+ or Bun on the server.

## Ecosystem practices

This repo follows the shared practices in `../tosijs-coding-practices` (start at its `README.md`; check `practices/rollouts.md` for standing rollouts).

- Publishing goes through the shared OIDC workflow (`.github/workflows/publish.yml`, an unchanged copy of the practices template; don't edit it locally). Run `bun ../tosijs-coding-practices/tools/release-doctor.ts` before any release.
- Not applicable: Prettier never touches markdown — this repo has no Prettier config or dependency.
