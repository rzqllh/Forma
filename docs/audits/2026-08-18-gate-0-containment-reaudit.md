# Gate 0 Containment Re-Audit

## Document Status

- Date: 2026-08-18
- Auditor role: read-only product auditor and implementation-plan writer
- Implementation under review: commit `cfa28b1`
- Original audit: `docs/audits/2026-08-18-full-app-audit.md`
- Production testing boundary: read-only HTTP requests only
- Product code changed by this audit: none
- Verdict: **Fail, correction required before Gate 1 can be accepted**

## Executive Verdict

Gate 0 improved the production boundary and fixed the local-history mutation bug, but it did not complete the containment acceptance criteria.

The deployed API now fails closed when a request omits the configured credential, and its CORS policy rejects an arbitrary origin. The remaining browser credential is not secret: `NEXT_PUBLIC_APP_SHARED_SECRET` is embedded in the public static export and automatically attached to every API request. Anyone who can load the app can recover the credential and call the API outside the UI.

Cloud upload handling now rejects missing or non-HTTPS asset URLs. History persistence still hides the difference between a successful D1 write and local fallback, so the export UI can report that a batch was recorded in History when only local storage accepted it.

The test process exits successfully with 39 passing assertions, but stderr still contains background processing failures, IndexedDB failures, and unintended network requests. That result is not a valid release gate.

## Gate 0 Traceability

| Original finding | Required outcome | Re-audit status | Fact classification | Evidence summary |
|---|---|---|---|---|
| F-001 | Production API fails closed without valid identity or credential | **Pass** | Confirmed | Read-only `GET /api/presets` returned `401` after deployment. Unit tests cover missing and empty server configuration. |
| F-002 | Replace the public shared-secret model and reject arbitrary origins | **Fail** | Confirmed | Arbitrary-origin preflight returned `403`, but the production build embeds `NEXT_PUBLIC_APP_SHARED_SECRET` in four public JavaScript files. |
| F-003 | Never report cloud-history success without durable uploaded assets and verified persistence | **Partial** | Confirmed | Cloudinary upload now requires a durable HTTPS URL. `saveBatchHistory` still catches every API failure, writes local fallback, and resolves as success without telling the caller which persistence target succeeded. |
| F-004 | Local delete, restore, and save preserve unrelated active and deleted records | **Pass** | Confirmed | Mutations now use the full unexpired collection. Regression tests cover active and deleted records coexisting. |
| F-028 | A passing queue suite must prove terminal outcomes and contain no hidden asynchronous failures | **Fail** | Confirmed | The suite reports 39 passing tests while queue processing fails on `createImageBitmap` and session persistence fails on IndexedDB in stderr. |

## Numbered Findings

### G0-RA-001: Browser-shipped shared secret is not an access boundary

- Severity: P0
- Status: Confirmed
- Affected flow: presets, history, upload signing, D1 writes, Cloudinary upload authorization
- Evidence:
  - `lib/api/client.ts` reads `NEXT_PUBLIC_APP_SHARED_SECRET` and attaches it as `X-App-Secret`.
  - `.env.example` instructs maintainers to place the same value in `APP_SHARED_SECRET` and `NEXT_PUBLIC_APP_SHARED_SECRET`.
  - A fresh `pnpm build` embedded the configured public value in four files under `out/**/*.js`. The audit compared values without printing the credential.
  - The Worker checks equality with that browser-delivered value. CORS does not stop scripts, command-line clients, or copied credentials from calling the API.
- Reproduction:
  1. Configure `NEXT_PUBLIC_APP_SHARED_SECRET` with a non-empty test value.
  2. Run `pnpm build`.
  3. Search the exported JavaScript for the configured value.
  4. Observe that the browser bundle contains it.
- Root cause: the design treats a build-time public environment variable as confidential authentication material.
- Required remediation: remove the browser shared-secret contract and place a real identity-aware boundary in front of the app and API.

### G0-RA-002: History persistence result does not distinguish remote success from local fallback

- Severity: P1
- Status: Confirmed
- Affected flow: Export Studio, cloud history, reload on another device, operator status messages
- Evidence:
  - `saveBatchHistory` catches Worker API failure, stores the batch in local storage, and returns the same data shape as a D1 success.
  - `app/export/page.tsx` awaits that function and reports that uploads were recorded in History.
  - The caller receives no `remote`, `local-only`, or `failed` persistence status.
- Reproduction:
  1. Allow Cloudinary upload to return valid HTTPS URLs.
  2. Make the D1 history endpoint unavailable or return an error.
  3. Trigger Save to History.
  4. Observe that local fallback resolves and the UI can report a successful History write.
- Root cause: transport fallback and product outcome share one return type and one success path.
- Required remediation: return a discriminated persistence result and expose a local-only, retryable state when D1 fails.

### G0-RA-003: Tests still pass while background work fails

- Severity: P1
- Status: Confirmed
- Affected flow: queue correctness, local-history regression confidence, CI signal
- Evidence:
  - `pnpm test -- --run` exited `0` with 39 passing tests.
  - Queue stderr contained `createImageBitmap` job failures and IndexedDB persistence failures.
  - Local-history tests attempted real requests to `localhost:8787` and logged `ECONNREFUSED`.
  - Tests assert immediate state or local effects without awaiting and validating the complete asynchronous outcome.
- Reproduction:
  1. Run `pnpm test -- --run` without a local Worker server.
  2. Observe 39 passing assertions.
  3. Inspect stderr for processing, IndexedDB, and network errors.
- Root cause: queue execution, persistence, and API transport are not injected test boundaries. Fire-and-forget work outlives the assertions that triggered it.
- Required remediation: use deterministic fakes for processing, persistence, and API transport; await terminal job state; fail tests on unexpected console errors and unhandled asynchronous work.

### G0-RA-004: Source-of-truth documents overstate Gate 0 completion

- Severity: P2
- Status: Confirmed
- Affected flow: remediation sequencing and handoff between planning and implementation agents
- Evidence:
  - `docs/execution-plan.md` marks Gate 0 as completed.
  - `docs/status.md` marks containment as pass.
  - G0-RA-001 and G0-RA-002 remain open.
- Root cause: implementation completion was recorded before independent re-audit.
- Required remediation: keep Gate 0 open until the correction acceptance checks pass.

## Confirmed Improvements

The re-audit confirmed these improvements from commit `cfa28b1`:

- The deployed preset endpoint returns `401` without `X-App-Secret`.
- A preflight request from `https://evil.example` returns `403` without `Access-Control-Allow-Origin`.
- The Worker rejects missing and blank `APP_SHARED_SECRET` configuration.
- History item validation rejects `blob:` and non-HTTPS asset URLs.
- Export skips failed uploads and does not create history when every upload fails.
- Local soft-delete, restore, and new-batch persistence preserve the complete unexpired collection.
- `pnpm build` and `pnpm typecheck` complete successfully when run serially.

## Correction Architecture Decision

Status: Proposed, pending product-owner approval.

### Option A: Cloudflare Access in front of the app and Worker, recommended

Protect the Worker and frontend with a single-owner Cloudflare Access policy, such as email one-time PIN or the owner's identity provider. Remove `NEXT_PUBLIC_APP_SHARED_SECRET` and the `X-App-Secret` browser contract. Let Access reject unauthenticated requests before they reach application routes.

Why this fits:

- It supplies an actual user session without adding an application account system.
- It keeps credentials out of the JavaScript bundle.
- Cloudflare supports protecting a Worker directly through a self-hosted Access application.
- It adds deployment configuration but no runtime package.

Operational tradeoff: the owner must pass the Access login, and the maintainer must configure and verify the Access policy for production and preview hosts.

References:

- <https://developers.cloudflare.com/cloudflare-one/access-controls/applications/choose-application-type/>
- <https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/>

### Option B: Application-managed authentication

Add an identity provider, server-side session validation, and authenticated API authorization.

Tradeoff: this provides full application control but adds dependencies, session lifecycle, UI states, and a larger security surface. It is disproportionate for the current single-owner tool unless Cloudflare Access is unavailable.

### Option C: Accept a public API

Remove the misleading shared-secret claim, retain strict validation and rate controls, and document the API as public.

Tradeoff: Gate 0 cannot pass the original containment requirement under this option. Anyone can create history records or request Cloudinary upload signatures unless further capability limits exist.

## Dependency-Ordered Correction Plan

### Task 1: Lock the access-boundary decision

- Owner: product owner plus deployment maintainer
- Decision: approve Cloudflare Access, approve application-managed auth, or explicitly accept a public API.
- No implementation should preserve `NEXT_PUBLIC_APP_SHARED_SECRET` as a secret.

### Task 2: Implement and verify the selected boundary

- Remove browser-secret configuration and request headers.
- Configure the selected identity boundary for the frontend, production Worker, and preview environment.
- Keep the strict CORS allowlist as defense in depth.
- Add read-only deployment smoke checks for unauthenticated rejection and authenticated owner access.
- Update `.env.example`, `ARCHITECTURE.md`, `docs/security.md`, `docs/decisions.md`, and `docs/deployment.md` to match the selected behavior. Create the missing `docs/api-contracts.md` before recording the final browser-to-Worker contract.

### Task 3: Make history persistence truthful

- Split the API call from the local fallback result.
- Return an explicit result such as `remote-saved`, `local-only`, or `failed`.
- Preserve local download and durable Cloudinary URLs when D1 is unavailable.
- Show a retryable local-only status instead of remote-history success.
- Add tests for Cloudinary success plus D1 failure, partial upload failure, and total upload failure.

### Task 4: Isolate Gate 0 regression tests

- Inject API transport into local-history functions so unit tests never contact port 8787.
- Make unexpected network calls fail the test.
- Treat unexpected stderr and unhandled asynchronous work as failures.
- Keep queue processing and IndexedDB correction in Gate 1, but do not cite the current suite as clean evidence.

### Task 5: Re-audit and close Gate 0

- Run build, typecheck, test, and the read-only production smoke checks.
- Inspect the static export and confirm that no confidential credential is embedded.
- Reproduce D1 failure and confirm the UI reports local-only persistence.
- Mark Gate 0 complete only after every acceptance check below passes.

## Correction Acceptance Criteria

- No confidential value used for API authorization exists in `NEXT_PUBLIC_*`, source, or exported JavaScript.
- An unauthenticated production request cannot reach protected presets, history, or upload-signing routes.
- An authorized owner can perform a read-only production request through the selected identity boundary.
- Arbitrary-origin preflight remains rejected.
- A failed D1 write cannot produce a remote-history success message.
- Partial and total Cloudinary upload failures show accurate item counts and retry direction.
- Local delete, restore, and save continue preserving unrelated records.
- Unit tests make no unintended network requests and emit no unexpected processing or persistence errors.
- `pnpm typecheck`, `pnpm test -- --run`, and `pnpm build` pass with clean expected output.
- Source-of-truth documents describe the deployed boundary and observed behavior accurately.

## Validation Record

| Check | Result | Acceptance |
|---|---|---|
| `pnpm build` | Exit 0, static export created | Pass |
| `pnpm typecheck` | Exit 0 after build | Pass |
| `pnpm test -- --run` | Exit 0, 39 tests passed, unexpected stderr present | Fail as quality gate |
| Production `GET /api/presets` without credential | `401` | Pass for F-001 |
| Production preflight from `https://evil.example` | `403`, no reflected origin | Pass for CORS subcondition |
| Static export credential scan | Configured public shared secret found in four JavaScript files | Fail for F-002 |
| Production mutation | Not run | Not applicable, prohibited by audit scope |

## Handoff Rule

Gate 1 design and planning may continue while the owner decides the access boundary. Gate 1 implementation must not be accepted as complete until this Gate 0 correction passes re-audit.
