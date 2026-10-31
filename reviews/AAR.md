# After-action reports

Newest first. Facts, not analysis (practices/releasing.md step 10).

## 1.1.0 — 2026-10-31

- Went well: the 1.0.0 tag was reconstructed from npm by rebuilding `d1214d6` and diffing the tarball (only export order differed). The review's M1 was cleared by a test that fails with the fix reverted, with no re-review.
- Didn't: approval came after the 60-minute window, so the stage run ended unverified and `verify_only` was needed.
- Surprised: making `decrypt` strict about key length would have stranded 1.0.0 data under caller-supplied AES-128/192 keys. Two lenses caught it independently. `engines >=15` was never true (Node 16 has no global `crypto`).
- Friction: TS 7 dropped automatic `@types` inclusion and refuses file arguments while a tsconfig exists. `virta set #n body=…` no-ops silently (tosijs-virta #3626). The auto-mode classifier blocked the tag push and publish trigger until the owner asked directly.
- Cycle: none
