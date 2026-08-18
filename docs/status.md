# Project Implementation Status: FORMA

## Document Status

- Last Updated: 2026-08-18
- Current Phase: Full Audit Complete; Stabilization Not Started
- Readiness: **Not ready for operator use**
- Audit: `docs/audits/2026-08-18-full-app-audit.md`
- Active plan: `docs/execution-plan.md`

## Summary Statement

> **Static typecheck and production build succeed, but the primary workflow is not verified. Four P0 findings cover deployed API exposure, false-success cloud history, and local history data loss. Product remediation has not started.**

No production write testing was performed during the audit. Production API checks were read-only.

## Current Gate Status

| Gate | Status | Blocking evidence |
|---|---|
| Containment | **Fail** | Production preset API answered without a credential; arbitrary-origin CORS; cloud-history false success; local delete/restore data-loss risk. |
| Processing foundation | **Fail** | No browser Worker implementation, no cancellation/stale-result protocol, and metadata/ICC claims do not match the pipeline. |
| Core operator flow | **Fail** | Per-photo option state is unsynchronized, session restore is route-dependent, and export/history failures are not represented truthfully. |
| UX and accessibility | **Fail** | 375 px clipping, keyboard-inoperable primary controls, incomplete dialog focus, and known contrast failures. |
| Quality gates | **Fail** | Queue tests are false-green, lint is interactive, fixture-based processing/integration/E2E coverage is missing. |

## Confirmed Implementation That Remains Usable

- Next.js static export builds successfully.
- TypeScript compilation succeeds.
- Basic resize dimension calculations, format selection, color application, watermark compositing, individual blob download, preset CRUD routes, and D1 schema exist.
- The queue supports bounded Promise concurrency and partial terminal states, but it does not provide the documented Worker isolation or complete cancellation/reliability contract.
- Light and dark theme tokens exist, but both themes have not passed complete acceptance.

## Verified Commands

| Purpose | Command | Result | Verified On |
|---|---|---|---|
| Typecheck | `pnpm typecheck` | 0 errors | 2026-08-18 (Node v22 / Windows) |
| Unit tests | `pnpm test` | Exit 0, 27 passed; **not accepted** because queue processing and IndexedDB failures appear in stderr | 2026-08-18 |
| Lint | `pnpm lint` | **Fail**: interactive ESLint setup prompt, not a reproducible quality gate | 2026-08-18 |
| Production build | `pnpm build` | Static export succeeded into `out/` | 2026-08-18 |

## Next Authorized Decision

Review the numbered audit findings and approve a remediation gate. Gate 0 containment must be completed before feature or visual polish work.
