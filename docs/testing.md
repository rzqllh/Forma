# Testing and Quality Gates

## Document Status

- Status: Draft
- Owner: Hafizh
- Last verified: 2026-08-18

## Quality Risk Summary

| Risk area | Failure impact | Test level | Required before release |
|---|---|---|:---:|
| Processing correctness (metadata strip, resize, watermark, color) | Wrong/corrupted output delivered to a client — the actual product risk | Unit tests on pure processing functions | Yes |
| Queue/concurrency behavior | Tab freeze or dropped jobs on large batches | Unit + manual test with a real large batch | Yes |
| 24h soft-delete/restore | Accidental permanent data loss | Unit test on the purge job's time boundary + manual restore test | Yes |
| Cloudinary integration | Upload failures block export | Mocked contract test + manual smoke test against real Cloudinary sandbox | Yes |
| Authentication/authorization | n/a — no auth model in v1 | — | No |
| Accessibility | Reduces usability for the one actual user | Manual keyboard/contrast pass | Yes, lightweight |
| Performance/capacity | Slow batch processing on her device | Manual timing with a real photoshoot batch | Yes, lightweight |

## Verified Commands

To be filled in once the project scaffold exists and each command has actually been run — do not record a command here until it has been verified, per the template's own rule.

| Purpose | Command | Preconditions | Expected result | Verified on |
|---|---|---|---|---|
| Typecheck | `pnpm typecheck` | TypeScript configured | 0 errors | 2026-08-18 (Node v22) |
| Unit tests | `pnpm test -- --run` | Vitest test suites | Exit 0, 39 tests pass, but unexpected queue, IndexedDB, and network errors make this an invalid quality gate | 2026-08-18 (Node v22) |
| Generate Migrations | `pnpm db:generate` | Drizzle schema | SQL migration generated | 2026-08-18 (Node v22) |
| Production build | `pnpm build` | Next.js static export | Export complete to `out/` | 2026-08-18 (Node v22) |

## Test Levels and Ownership

| Level | Purpose | Runs where | External dependencies | Owner |
|---|---|---|---|---|
| Static checks | Lint, typecheck | CI (GitHub Actions, free tier) | None | Hafizh |
| Unit | Processing functions (`lib/processing`), queue logic (`lib/queue`) | Vitest, local + CI | None (pure functions, Canvas mocked where needed) | Hafizh |
| Integration | Worker API endpoints (preset CRUD, signed upload, soft-delete) | Vitest + `wrangler dev` local D1 | Mocked Cloudinary | Hafizh |
| Manual acceptance | Full upload→process→export flow, restore-from-trash flow | Real browser, real Cloudinary sandbox | Cloudinary sandbox account | Hafizh (and a walkthrough with partner before first real use) |

No dedicated E2E/contract/performance/security test tiers — disproportionate to a single-user internal tool. Manual acceptance covers what E2E would otherwise cover here.

## Required Checks by Change Type

| Change | Minimum required validation |
|---|---|
| Processing logic (metadata/resize/watermark/color) | Unit test proving correct output on a representative sample image, including edge cases (already-stripped metadata, transparent PNG watermark, very small/large source image) |
| Queue/worker-pool logic | Unit test for concurrency limiting and partial-failure handling (one job fails, others continue) |
| Local-history logic | Injected API transport; no real localhost request; active and deleted records preserved together |
| Soft-delete/purge job | Unit test asserting the 24h boundary — a record at 23h59m is untouched, a record at 24h01m is purged |
| Worker API endpoint | Schema validation test + shared-secret rejection test (negative case) |
| UI behavior | Manual pass through loading/empty/error/success states listed in `DESIGN.md` |
| Deployment/config | Manual smoke test against the deployed Preview URL before promoting to production |

## Fixtures and Test Data

- Fixture location: `lib/processing/__fixtures__/` — a small set of representative sample photos (a normal JPEG with EXIF, a transparent-PNG logo, an already-metadata-stripped file, an oversized file) checked into the repo for unit tests.
- Cloudinary isolation: tests use a separate Cloudinary folder/sandbox, never the production folder her real client photos live in.
- Time control: purge-job boundary tests use an injectable clock rather than real `Date.now()`, so the 24h test doesn't require actually waiting 24 hours.

## Non-functional Testing

### Performance

- Scenario: process a real ~40-photo batch of camera JPEGs (10-20MB each) on her actual laptop before calling v1 done — this is the one performance check that matters here, and it's manual, not automated.

### Accessibility

- Automated: none required at this scale, but no obvious violations should ship (see `antislop-human` checklist when building the UI — contrast, focus states, keyboard operability).
- Manual: keyboard-only pass through the upload → edit → export flow at least once before first real use.

### Resilience

- Cloudinary outage/timeout: verify the app degrades to "download works, history save failed, retry available" rather than blocking the whole export.

## Coverage Policy

Coverage is a diagnostic, not a target, here even more than usual — this is a single-user tool, not a product with a large surface to protect. Focus effort on the processing correctness and the delete/restore boundary, since those are the two places a bug actually costs her something (a wrong export, or lost work).

## Manual Acceptance Record

Before the first real use with actual client photos, walk through once and record:

- steps performed: upload a real batch → apply metadata strip + watermark + resize → export → confirm history appears → delete a batch → confirm restore works within 24h
- browser/device: her actual laptop/browser, not just Hafizh's dev machine
- tester and date: to be filled in when this actually happens

## Passing Change Definition

- Lint, typecheck, and unit tests pass.
- Unit tests emit no unexpected stderr, make no unintended network requests, and await all asynchronous work they start.
- The specific risk areas above (processing correctness, queue behavior, 24h boundary) have test evidence, not just "it worked when I clicked around."
- Any check skipped for a given change is noted with a reason, rather than silently omitted.
