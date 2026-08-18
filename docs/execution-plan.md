# Execution Plan

## Active Work

- Workstream: Full app audit and stabilization roadmap
- Owner: repository maintainer
- Started: 2026-08-18
- Audit status: complete on `docs/full-app-audit`
- Product remediation status: not started; requires explicit phase approval
- Primary evidence: `docs/audits/2026-08-18-full-app-audit.md`
- UI findings: `anti-slop/audit-001-2026-08-18.md`

## Audit Completion

- [x] Inventory product routes, components, processing modules, storage, API, schema, tests, and owning docs.
- [x] Trace every documented feature to executable code and assign `Pass`, `Partial`, `Fail`, `Not Implemented`, or `Unknown`.
- [x] Reproduce the false-green queue suite and record validation limitations.
- [x] Verify production API exposure with read-only requests only.
- [x] Inspect desktop and 375 px layouts and run contrast checks.
- [x] Record P0-P3 findings with evidence, reproduction, root cause, and remediation direction.
- [x] Reconcile documentation conflicts without changing product behavior.
- [x] Correct `docs/status.md` so it no longer claims production readiness.

## Remediation Sequence

Implementation must proceed in order. A later gate cannot be called complete while an earlier gate has unresolved acceptance failures.

### Gate 0: Containment (Completed)

- [x] Enforce a real API access boundary and strict production configuration (fail-closed auth in `workers/api/index.ts`).
- [x] Enforce strict CORS origin allowlist rejecting unauthorized origins (F-002).
- [x] Stop false-success cloud history: Zod schema enforces durable `https://` URLs, and UI separates cloud upload errors from success (F-003).
- [x] Protect local history from mutation loss: `softDeleteBatch`, `restoreBatch`, and `saveBatchHistory` operate on full unexpired batch collections without discarding active records (F-004).
- [x] Add regression tests for unauthenticated access, CORS, durable upload/history, and local delete/restore (`tests/worker-api.test.ts` & `tests/local-history.test.ts`).

### Gate 1: Processing Foundation

- Introduce a typed browser Worker protocol with cancellation and stale-result rejection.
- Make metadata/ICC behavior explicit and verifiable.
- Guarantee failure-path cleanup and required-operation error handling.
- Validate 1, 10, and 40-photo batches with representative fixtures.

### Gate 2: Core Operator Flow

- Establish per-photo/batch option ownership and scoped undo/redo.
- Restore sessions before every route reads queue state.
- Complete truthful resize, export, history, retry, and offline states.

### Gate 3: UX and Accessibility

- Apply only approved anti-slop finding numbers.
- Consolidate navigation/actions and remove mobile overflow.
- Complete keyboard, dialog, contrast, theme, motion, and all data states.

### Gate 4: Quality and Documentation

- Make lint, processing tests, Worker/API integration tests, and browser E2E deterministic.
- Verify deployment, backup, rollback, and monitoring in the actual Cloudflare environment.
- Update all owning documents only after implementation and acceptance evidence match.

## Global Acceptance Gate

- No production write testing without a separately approved test tenant or disposable data scope.
- No new production dependency without purpose, alternatives, risk, and explicit approval.
- No success state without a verified successful outcome.
- P0 and P1 regression tests must fail before their fixes and pass afterward.
- Final operator acceptance requires an anonymized 40-photo interior set on the target laptop in Chrome and Edge, plus a 375 px mobile check.
