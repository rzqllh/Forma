# Full App Audit: FORMA

- Audit date: 2026-08-18
- Audit target: commit `ca5fdf3`
- Branch: `docs/full-app-audit`
- Verdict: **NOT READY FOR OPERATOR USE**
- Scope: product flow, processing correctness, state, storage, API, security, UX, accessibility, responsive behavior, tests, and documentation
- Mutation policy: production read-only; no product code, API, schema, or runtime behavior changed

## 1. Evidence Classification

- **Confirmed**: demonstrated by source inspection, automated command output, or a reproducible runtime check.
- **Inferred**: strongly indicated by implementation, but needs representative operator data or a browser/device trace to quantify.
- **Proposed**: remediation direction only. It is not current behavior and is not approved implementation scope.
- **Unknown**: cannot be closed without external data, credentials, or hardware that was not available during this audit.

Severity uses four levels:

- **P0**: current security exposure, data loss, or a success state that can create unrecoverable operator error.
- **P1**: core workflow is unreliable, materially contradicts the product contract, or blocks safe operation.
- **P2**: important quality, accessibility, maintainability, or contract gap.
- **P3**: polish or hygiene issue with limited direct operational impact.

## 2. Executive Verdict

FORMA builds and typechecks, but those results do not prove its primary workflow. The current app can process a happy-path image in a browser, yet the surrounding system is not deterministic or truthful enough for production use.

Four P0 blockers require containment before real operator data is trusted:

1. The deployed presets endpoint returned `200` without a credential.
2. CORS accepted an arbitrary hostile origin, while the client credential is included in public browser JavaScript.
3. Cloud history can report success while persisting an ephemeral `blob:` URL instead of a durable Cloudinary URL.
4. Local soft-delete and restore rebuild storage from the wrong filtered subset and can remove unrelated active history.

The largest architectural gap is also confirmed: no browser `Worker` is created anywhere in the app. The concurrency manager runs Canvas decoding and pixel processing from the UI thread, directly contradicting the documented Web Worker pool and the 40-photo responsiveness target.

## 3. Validation Evidence

| Check | Result | Interpretation |
|---|---|---|
| `pnpm install --frozen-lockfile` | Pass, 515 packages reused from the store | Worktree matches the committed lockfile; no dependency or lockfile change. |
| `pnpm typecheck` | Pass in the audit worktree | Static types do not cover the runtime failures below. |
| `pnpm test` | Exit 0, 27 tests across 4 suites | **False-green quality gate**: queue jobs emit `createImageBitmap` failures and IndexedDB errors after assertions pass. |
| `pnpm build` | Pass in the audit worktree | Static export succeeds; it does not validate operator flow or API durability. The worktree build emits a multiple-lockfile root warning. |
| `pnpm lint` | Fail as a reproducible gate | `next lint` opens an interactive setup prompt because ESLint is not configured, even with `CI=1`. |
| Desktop visual inspection | Partial | Routes render and the main visual system is present. |
| 375 x 812 inspection | Fail | Header, tab switcher, dropzone/empty content, and bottom navigation clip or overflow. |
| Production `/api/health` read | `200`, `Access-Control-Allow-Origin: *` | Deployed API permits broad reads. |
| Production `/api/presets` without credential | `200` | The deployed access gate is not enforced. Response contents were not printed or modified. |
| Production preflight from `https://evil.example` | `204`, origin reflected | Arbitrary browser origins are authorized by CORS. |
| Git state before audit | Clean | Findings are against committed behavior, not unrelated local edits. |

Limitations:

- No production create, update, delete, upload, or purge call was made.
- No anonymized 40-photo operator fixture set or Cloudinary sandbox was available.
- Safari, real mobile hardware, 200% text zoom, long-task profiling, and memory profiling remain `Unknown` acceptance items.

## 4. Feature Traceability Matrix

| Capability | Intended contract | Current status | Evidence summary |
|---|---|---|---|
| Upload and validation | Multi-file JPEG/PNG/WebP, magic-byte validation, per-file feedback | **Partial** | MIME allowlist and warning exist; magic-byte sniff, batch cap, and hard safety boundary do not. Upload starts processing immediately. |
| Batch queue | Concurrency-limited Web Worker pool, progress, partial failure, cancellation | **Fail** | Promise concurrency exists on the main thread. No `new Worker`, cancellation API, or deterministic in-flight option invalidation. |
| Metadata cleaner | Optional EXIF/GPS removal while preserving ICC | **Fail** | Every pipeline run rasterizes through a fresh Canvas regardless of the toggle. ICC preservation is neither implemented nor tested. |
| Resize and compression | Presets, custom dimensions, formats, quality, live estimate | **Partial** | Presets/formats/quality exist. Custom width/height inputs and live estimate are absent; “bicubic” is only smoothing quality. |
| Color preview | Non-destructive preview with guarded adjustment | **Partial** | Adjustment is baked into output, but full-resolution histogram/pixel work runs on the UI thread and visual correctness lacks fixtures. |
| Watermark studio | Durable D1 preset, validated transparent logo, offsets, accurate preview | **Partial** | Basic settings and compositing exist. Logo is stored as a data URL, transparency is not inspected, offsets/drag controls are absent, and failures can be silent. |
| Per-photo editor | Each photo retains independent options and reliable undo/redo | **Fail** | Editor controls are global and do not load each selected job's options. Undo history is also global. |
| Session persistence | Active jobs recover safely after refresh | **Partial** | IndexedDB restore is called only from `/edit`; direct `/` and `/export` refreshes appear empty. Persistence errors are warnings only. |
| Comparison slider | Geometrically valid before/after comparison, keyboard operable | **Fail** | Pointer-only control. Different pre/post resize geometry can be overlaid with `object-contain`, making the comparison misleading. |
| Export single/ZIP | Durable downloads, unique names, large-batch safe packaging | **Fail** | Single download works on a live blob. ZIP buffers all files, can overwrite duplicate names, and is not streaming. |
| Cloud history | Signed uploads followed by durable D1 history with retry | **Fail** | Upload failures fall back to `blob:` URLs, API failures fall back locally, and UI can still announce success. |
| Preset CRUD | D1 source of truth with explicit offline state | **Partial** | CRUD exists, but every remote error is silently converted into local success and can diverge from D1. |
| Trash and restore | Soft delete, restore within 24 hours, safe purge | **Fail** | Remote path exists; local fallback can discard active records. Countdown is not live. Purge deletes D1 rows even when Cloudinary deletion fails. |
| API authorization | Server-enforced internal access boundary | **Fail** | Browser-shipped shared secret is not secret; deployed endpoint is reachable without it. |
| API data consistency | Atomic batch/history writes and explicit failure states | **Fail** | Batch and item writes are not transactional. Client errors are broadly swallowed. |
| Responsive layout | Complete mobile reflow with no clipping | **Fail** | Reproducible clipping at 375 px and duplicated fixed navigation/action chrome. |
| Keyboard/accessibility | Operable controls, focus management, AA contrast | **Fail** | Dropzone and split slider are mouse/pointer-only; custom select and modals have incomplete keyboard/focus behavior; known contrast failures exist. |
| Themes and motion | Both themes valid, system-aware, reduced-motion safe | **Partial** | Light/dark toggle exists. Default ignores system preference and no reduced-motion treatment was found. |
| Automated quality gates | Deterministic lint, unit, integration, E2E, build | **Fail** | Typecheck/build pass, but processing tests do not prove successful output, worker tests do not call the worker, lint is interactive, and no E2E suite exists. |
| Deployment and operations | Documented workflow, backup, rollback, monitoring | **Unknown** | Deployment docs reference a missing workflow and contain unverified placeholders. No production mutation was authorized. |

## 5. Findings

### P0: Containment Required

| ID | Fact | Affected flow | Evidence and reproduction | Root cause | Proposed direction |
|---|---|---|---|---|---|
| F-001 | **Confirmed**: deployed API data is readable without a credential. | Presets, history, upload signing boundary | Read-only `GET /api/presets` returned `200` without `X-App-Secret`. Worker auth returns true when `APP_SHARED_SECRET` is absent (`workers/api/index.ts`, `verifyAuth`). | Missing server configuration fails open. | Fail closed outside an explicit local-development mode; add a deployment smoke test that expects `401` without valid identity. |
| F-002 | **Confirmed**: arbitrary web origins are authorized and the supposed secret is public. | All browser API calls | Preflight from `https://evil.example` returned `204` and reflected that origin. `corsHeaders` reflects `Origin`; `lib/api/client.ts` reads `NEXT_PUBLIC_APP_SHARED_SECRET`. | Browser-delivered static clients cannot keep shared credentials secret; CORS uses reflection instead of an allowlist. | Replace the browser shared-secret model with a real access boundary, then enforce a strict origin allowlist as defense in depth. |
| F-003 | **Confirmed**: cloud history can report success with non-durable asset URLs. | Export, history, redownload | Disable/fail signing or return a non-OK Cloudinary upload. `uploadedUrl` remains `job.resultBlobUrl`; `saveBatchHistory` falls back locally; UI sets “Berhasil disimpan ke Riwayat!”. | Upload success, history persistence, and UI success are not represented as separate states. | Require a durable HTTPS asset URL before history success; preserve local download but expose retryable sync failure per item. |
| F-004 | **Confirmed**: local soft-delete/restore can discard unrelated history. | Offline history, trash, restore | Seed active and deleted local batches, then call `softDeleteBatch` or `restoreBatch`. Both rebuild storage from `getLocalBatches(true)`, which returns deleted records only. | A filtered read is reused as the complete persistence set. | Load the complete unexpired collection for mutations, update one record, and atomically save the full set; cover active + deleted coexistence in tests. |

### P1: Core Workflow and Reliability

| ID | Fact | Affected flow | Evidence and reproduction | Root cause | Proposed direction |
|---|---|---|---|---|---|
| F-005 | **Confirmed**: processing does not use Web Workers. | Upload, editor responsiveness, 40-photo batch | Repository search finds no `new Worker`, message handler, or worker entrypoint. `scheduleNext` calls `processJob`, which calls the Canvas pipeline directly. | “Worker” is a counter over concurrent Promises, not a thread boundary. | Move decode/pixel/encode work behind a typed Worker protocol and transfer buffers; keep UI state orchestration on the main thread. |
| F-006 | **Confirmed**: upload begins processing before the operator configures the batch. | Upload to editor | `addFiles` calls `scheduleNext` immediately. Upload copy presents a later processing step and `/edit` still offers “Proses Semua”. | Enqueue and execute are coupled. | Separate file admission/preview from an explicit processing command, or make auto-processing truthful and remove redundant controls. |
| F-007 | **Confirmed**: options changed during processing can produce stale or intermediate output. | Sliders, preset changes, per-photo output | Change controls rapidly while a job is `processing`. `updateJobOptions` mutates the job but does not cancel/version the active run; completion writes its result back to the same job. | No immutable job snapshot, generation token, or abort protocol. | Version every processing request and discard stale completions; debounce continuous controls and support cancellation. |
| F-008 | **Confirmed**: cancellation is documented but not implemented. | Batch queue, navigation away | Queue states include `cancelled`, but there is no public cancel method or Worker termination. `startBatch` only requeues already-cancelled jobs. | State vocabulary exists without the behavior behind it. | Add cancel-one/cancel-batch contracts with abort and resource cleanup, or remove the unsupported promise from docs/UI. |
| F-009 | **Confirmed**: the metadata toggle does not control metadata stripping. | Metadata cleaner, operator trust | Set `stripMetadata` false and process. `processImageSource` always calls `stripMetadataFromImageBitmap`; only the reported `metadataStripped` boolean follows the option. | Rasterization is unconditional while status reporting is conditional. | Define truthful semantics: either metadata stripping is mandatory and the toggle is removed, or implement a byte-preserving path for the disabled state. |
| F-010 | **Confirmed**: ICC preservation is an unsupported product claim. | Export color fidelity | Docs promise ICC preservation; code always Canvas-decodes and re-encodes without extracting/reinserting a profile. Tests only search a small byte prefix for an EXIF marker. | Canvas output behavior was treated as equivalent to explicit profile preservation. | Decide the color-management contract, validate exported profiles with real fixtures, and revise docs/UI to match measurable behavior. |
| F-011 | **Confirmed**: requested watermark failure can still produce a successful job without a watermark. | Watermark export | Break the preset logo URL. `loadLogoBitmap` warns and continues; pipeline only composites when a bitmap exists, then job becomes `done`. | Watermark is treated as optional after the operator enabled it. | Make required-operation failure explicit and retryable; do not mark the job done with an incomplete result. |
| F-012 | **Confirmed**: decoded bitmap cleanup is success-path only. | Large batches, memory stability | Throw after `loadImageBitmap` but before successful pipeline completion. `close()` calls are after `processImageSource`, not in `finally`. | Resource lifetime is not guarded across failure paths. | Close all owned ImageBitmaps and revoke superseded URLs in `finally`; verify with failure-path tests. |
| F-013 | **Confirmed**: editor controls do not reflect each selected job's options. | Per-photo customization | Upload jobs use `custom/contain/jpeg`; editor initializes `client-delivery-hd/contain/jpeg`. Selecting another job only changes `activeJobId`; it never loads `job.options`. | UI options and queue job options have separate unsynchronized sources of truth. | Load controls, preset selection, and undo history from the active job; keep history scoped per job or explicitly batch-wide. |
| F-014 | **Confirmed**: undo/redo is global and can apply another photo's state. | Multi-photo editing | Edit photo A, select photo B, then undo. The single component-level history is reused and `applyOptionsToActive` applies it to B. | History is scoped to the page rather than an editing target. | Store history by job ID, or define and label a batch-global editing model. |
| F-015 | **Confirmed**: session restore is route-dependent. | Refresh/recovery | IndexedDB restore is called only in `/edit`. Refreshing `/` or `/export` subscribes to the empty in-memory queue without restoring first. | Persistence was added at one route instead of queue/app bootstrap. | Restore once at an application-level provider before route state is evaluated, with visible recovery failure. |
| F-016 | **Confirmed**: custom dimensions and live estimates are documented but absent from the UI. | Resize/compress | Choose the `custom` preset. Types/calculation accept width and height, but no width/height controls are rendered; feature docs require custom dimensions and live estimates. | Backend capability and UI contract diverged. | Add validated custom fields and deterministic estimates, or remove the custom option and related claims for v1. |
| F-017 | **Confirmed**: before/after comparison can be geometrically invalid and is pointer-only. | Color preview, accessibility | Process a source through a crop/aspect-ratio preset. Original and final images are separately `object-contain` overlaid; slider has pointer handlers but no slider role, value, or keyboard controls. | Comparison combines different coordinate spaces and uses a generic div as a control. | Compare two renders in the same final geometry and implement native/ARIA slider keyboard semantics. |
| F-018 | **Confirmed**: ZIP generation is memory-heavy and filename collisions are possible. | Batch export | Upload two files with the same basename, export ZIP. Both target `${baseName}_finished.ext`; JSZip buffers the archive with DEFLATE. | No collision allocator and no streaming/backpressure design. | Generate deterministic unique names and establish an evidence-based batch/byte ceiling or streaming implementation. |
| F-019 | **Confirmed**: partial cloud upload can orphan assets and has no per-item retry state. | Cloud sync/history | Let one upload succeed and a later upload/history write fail. Successful assets have no durable retry record; UI has one global status. | The sync is a monolithic loop without a persisted per-item state machine. | Track sign/upload/history states per item, retry idempotently, and clean up or reconcile orphan assets. |
| F-020 | **Confirmed**: remote API failures are broadly converted into local success. | Presets, history, offline behavior | Force timeout/500/401. Fetches return local data; create/update synthesize success; delete ignores remote errors; history save synthesizes local history. | Offline fallback catches all failures without classifying network, auth, validation, conflict, or server errors. | Make offline mode explicit, preserve error classes, and surface sync state/conflict instead of claiming remote success. |
| F-021 | **Confirmed**: history batch and items are not written atomically. | D1 history consistency | Inspect POST batch handler: batch and item inserts are separate operations without a transaction/batch atomicity guard. | Multi-record persistence lacks a unit-of-work boundary. | Use D1 batch/transaction semantics and make retry idempotent with a client operation key. |
| F-022 | **Confirmed**: purge can delete database records when Cloudinary deletion fails. | 24-hour trash, storage retention | Mock Cloudinary destroy as non-OK. Code does not inspect `response.ok`, increments `purgedAssets`, then deletes D1 rows. Missing Cloudinary configuration also proceeds to D1 deletion. | Asset deletion outcome is detached from metadata deletion policy. | Retain a retryable tombstone until deletion is confirmed, or explicitly record an orphan reconciliation job. |
| F-023 | **Confirmed**: watermark logo persistence violates the storage contract and lacks boundary validation. | Preset CRUD, D1 size/security | Upload a logo. `FileReader` data URL is assigned to `logoUrl` and sent through preset CRUD; size, magic bytes, SVG safety, and actual transparency are not validated. | Preview representation is reused as durable storage representation. | Upload logos through a validated storage boundary and persist only durable URLs plus normalized settings. |
| F-024 | **Confirmed**: `returnTo` is passed to router navigation without an allowlist. | Preset-to-editor navigation | Supply a crafted `returnTo` query. It is concatenated and sent directly to `router.push`. | A user-controlled navigation target crosses a client boundary without validation. | Accept only known internal routes and build query parameters with `URLSearchParams`. |
| F-025 | **Confirmed**: file admission trusts browser MIME metadata only. | Upload security and reliability | Rename/forge an unsupported payload with an allowed MIME type. Dropzone checks `file.type` only; the documented magic-byte sniff is absent. Oversized files still proceed. | UI hint validation is treated as a trusted boundary. | Inspect signatures before decode, set explicit size/batch limits, and report rejected files individually. |
| F-026 | **Confirmed**: responsive layout fails at the target 375 px viewport. | All operator routes on mobile | Headless visual inspection at 375 x 812 shows clipped tab navigation, header/dropzone or empty-state content, and bottom navigation. | Desktop-scale fixed/floating chrome and insufficient shrink/reflow constraints. | Redesign the narrow layout around one task bar, flexible children, safe-area space, and zero page-level horizontal overflow. |
| F-027 | **Confirmed**: primary custom controls are not fully keyboard operable. | Upload, select, compare, confirmation, preview | Tab/keyboard inspection: Dropzone is a clickable div; split slider is pointer-only; CustomSelect lacks arrow/Home/End focus movement; dialogs have no focus trap/restore and destructive confirm is auto-focused. | Visual custom controls were built without complete interaction contracts. | Prefer native controls where possible; otherwise implement WAI-ARIA patterns, safe initial focus, trap/restore, and automated keyboard tests. |

### P2: Quality, UX, and Contract Integrity

| ID | Fact | Affected flow | Evidence and reproduction | Root cause | Proposed direction |
|---|---|---|---|---|---|
| F-028 | **Confirmed**: queue tests are false-green. | CI confidence | `pnpm test` reports 27 passes while queue jobs log `createImageBitmap` failures and IndexedDB errors. Assertions stop at enqueue/state mutation. | Tests do not await terminal job state or fail on unexpected console errors. | Mock boundaries deliberately, await success/error completion, assert output, and fail tests on unhandled processing errors. |
| F-029 | **Confirmed**: processing tests do not validate real encoded output. | Metadata, resize, watermark, color | Existing tests cover calculations and marker helpers; the documented image fixtures directory is missing. | Pure helper coverage was reported as end-to-end processing correctness. | Add representative EXIF/ICC/JPEG/PNG/WebP fixtures and decode/encode pixel and metadata assertions. |
| F-030 | **Confirmed**: Worker API tests do not exercise Worker handlers or purge. | API/security/data lifecycle | `tests/worker-api.test.ts` contains schema/helper-level checks; purge behavior is not invoked against a D1 test database and mocked Cloudinary. | Contract tests are disconnected from runtime handlers. | Add local Worker integration tests for auth, CORS, CRUD, atomic failure, upload signing, trash, restore, and purge. |
| F-031 | **Confirmed**: lint is not a usable quality gate. | Local development, CI | `pnpm lint` invokes deprecated `next lint` and opens an interactive configuration prompt. | Script and config were never finalized for Next 15/ESLint 9. | Add a committed non-interactive ESLint configuration and run `eslint` directly without hiding existing failures. |
| F-032 | **Confirmed**: design tokens contain known contrast failures. | Buttons, boundaries, light theme | Contrast calculation: white on accent gold is about 2.57:1; the light border against background is about 1.34:1 where the border is the only control boundary. | Hardcoded `text-white` overrides token foreground; subtle borders are used as functional boundaries. | Use token foregrounds and raise non-text boundary contrast to 3:1 where required. |
| F-033 | **Confirmed**: reduced-motion and system-theme preferences are not respected. | Theme, accessibility, comfort | No `prefers-reduced-motion` rule found. Theme initializes to light rather than system preference; multiple scale/fade/pulse classes remain active. | Preference handling is component-local and motion has no policy. | Add a single theme bootstrap and reduce/disable non-essential motion for user preference. |
| F-034 | **Confirmed**: several intended Tailwind utilities do not exist. | Responsive labels, animation, spacing | `xs:` is used without a configured breakpoint, `py-0.2` is invalid, and `animate-in/fade-in/zoom-in-95` are used without the expected animation plugin. | Utility names were written beyond the actual Tailwind configuration. | Replace with configured utilities or deliberately add configuration after dependency review. |
| F-035 | **Confirmed**: navigation and action hierarchy are duplicated. | All routes, editor | App has a sticky top header, floating global bottom dock, page tabs, and a separate fixed editor action bar. `DESIGN.md` specifies a persistent top bar and no multi-section navigation. | Surface-level polish accumulated without a single operator task model. | Choose one global navigation pattern and one contextual action region based on the actual workflow. |
| F-036 | **Confirmed**: loading and remote-error states are not truthful. | Home history, presets | API client swallows failures and returns local/empty data, so route-level `catch` blocks rarely receive errors. An outage can render as an empty list. | Data source and sync state are erased at the client boundary. | Return typed source/sync/error metadata and render distinct first-run, offline-cache, empty, loading, and error states. |
| F-037 | **Confirmed**: history metadata and trash timing can mislead. | History/trash | History cards label metadata clean regardless of recorded option; remaining trash time is calculated only when React renders and has no clock tick. | Presentation derives claims from assumptions instead of stored state/time. | Render `operationsApplied` truthfully and update expiry display on a bounded timer. |
| F-038 | **Inferred**: current automatic color treatment can introduce unwanted casts. | Color quality | Algorithm performs full-image per-channel histogram stretching plus fixed red/green lifts. Tests verify bounds, not representative interior color fidelity. | A heuristic is presented without a visual corpus or tolerances. | Establish operator-approved golden fixtures and compare color/delta/clipping before tuning or replacing the heuristic. |
| F-039 | **Confirmed**: OffscreenCanvas thumbnails are discarded. | Queue thumbnails | Offscreen branch creates `thumbBlob` and then assigns an empty `thumbnailDataUrl`; the UI keeps the original object URL. | Worker-oriented result transport was left unfinished. | Return a transferable thumbnail Blob or object URL with explicit lifetime ownership. |
| F-040 | **Confirmed**: schema/index documentation does not match executable schema. | D1 performance and maintainability | `docs/data-model.md` claims indexes for common lookups; migration/schema contain no corresponding `CREATE INDEX`/Drizzle index declarations. | Intended data model was not reconciled after schema generation. | Add measured indexes in a reviewed migration during remediation, or correct the data-model claim. |

### P3: Hygiene

| ID | Fact | Affected flow | Evidence and reproduction | Root cause | Proposed direction |
|---|---|---|---|---|---|
| F-041 | **Confirmed**: comments and copy overstate implementation quality. | Maintainer/operator trust | Source comments claim Apple HIG behavior, bicubic resize, Worker behavior, and parity that are not fully implemented or verified. | Aspirational comments were written as facts. | Keep comments to non-obvious intent and link measurable guarantees to tests. |
| F-042 | **Confirmed**: minor dead/unused code remains. | Maintenance | Examples include unused route imports and unused values such as `thumbBlob`; lint cannot currently report the complete set. | No stable lint gate and rapid UI iteration. | Clean only alongside related remediation after lint is active; avoid unrelated refactors now. |

## 6. Documentation Conflicts

| Topic | Intended source | Executable/current reality | Resolution status |
|---|---|---|---|
| Web Worker pool | `PROJECT.md`, `ARCHITECTURE.md`, ADR-001, batch queue feature | No Worker entrypoint or `new Worker`; processing runs from main-thread queue methods. | **Confirmed conflict**. Keep intent; implementation must change before claim is restored. |
| shadcn/ui | `ARCHITECTURE.md`, ADR-005 | No shadcn/Radix component dependency or generated component set. UI is custom Tailwind. | **Confirmed conflict**. Do not introduce a library without separate approval. |
| Session persistence | Architecture says in-memory only until export; status/code claim IndexedDB recovery | IndexedDB session store exists, but only `/edit` restores it. | **Confirmed conflict**. Product intent and all-route behavior must be decided together. |
| Metadata/ICC | Product/features promise optional stripping and ICC preservation | Canvas rasterization always runs; ICC preservation is not explicit or tested. | **Confirmed conflict**. Current UI/docs must not guarantee preservation. |
| Streaming ZIP | Export feature promises >500 MB streaming | JSZip `generateAsync` buffers the archive. | **Confirmed conflict**. Performance acceptance remains unknown. |
| Responsive quality | Status claims consistent breakpoints and no dock collision | 375 px inspection shows clipping/overflow after a commit claiming the opposite. | **Confirmed regression/claim mismatch**. |
| v1 complete | `docs/status.md` says complete and verified | P0/P1 failures exist and main workflow lacks valid acceptance evidence. | **Resolved by status correction in this audit branch**. |
| Tests and fixtures | `docs/testing.md` says 25 passes and names fixture directory | 27 tests run; fixture directory is missing; queue suite is false-green. | **Confirmed conflict**. Correct alongside quality-gate remediation. |
| Deployment workflow | `docs/deployment.md` names `.github/workflows/deploy.yml` | Referenced workflow is absent. | **Unknown operational state**. Verify actual Cloudflare deployment source before changing docs. |
| Security boundary | `docs/security.md` says strict Pages/localhost CORS and required secret | Worker reflects origins and fails open; deployment allowed unauthenticated preset read. | **Confirmed conflict and P0**. |

Repository instruction gaps also remain: `START-HERE.md`, `docs/api-contracts.md`, and the previously referenced `docs/execution-plan.md` were absent at audit start. This branch adds the execution plan only; the other missing source documents are not invented during audit.

## 7. Dependency-Ordered Remediation Roadmap

No item below is approved implementation scope yet.

### Gate 0: Containment

- Block unauthenticated production API access and replace the public shared-secret model.
- Enforce a strict server-side origin/access policy and deployment config validation.
- Stop reporting cloud-history success without durable asset URLs.
- Fix local history mutation so active and deleted records cannot be dropped.
- Add focused regression tests for all four P0 findings before redeploying.

### Gate 1: Processing Foundation

- Define a typed Worker request/result/error/cancel protocol.
- Make jobs immutable by processing generation and discard stale completion.
- Add cancellation, failure-path cleanup, and explicit required-operation errors.
- Decide and implement truthful metadata/ICC semantics.
- Prove output with representative encoded-image fixtures and a 1/10/40 batch profile.

### Gate 2: Core Operator Flow

- Establish one source of truth for per-photo vs batch options and undo history.
- Restore persisted session before every route reads queue state.
- Complete or remove custom resize/estimate promises.
- Make export and history a per-item durable state machine with unique filenames and retry.
- Separate online, offline, cached, empty, and failed states.

### Gate 3: UX and Accessibility Hardening

- Reframe navigation and actions around upload, configure, verify, export.
- Remove mobile overflow and duplicate fixed chrome; validate at 320 px through desktop.
- Replace or complete custom control semantics, dialog focus handling, contrast, and reduced motion.
- Audit every empty/loading/error state and all claims shown to the operator.
- Apply only user-approved numbered findings from `anti-slop/audit-001-2026-08-18.md`.

### Gate 4: Quality and Source-of-Truth Recovery

- Make lint non-interactive and CI-safe.
- Replace false-green tests with pipeline, Worker API, storage, and browser integration coverage.
- Add local D1 and Cloudinary sandbox contract tests; keep production smoke tests read-only except in an explicitly approved test tenant.
- Reconcile `PROJECT.md`, architecture, feature docs, security, data model, testing, deployment, decisions, and status after behavior is real.
- Run operator acceptance with a representative anonymized 40-photo set on the target laptop before marking v1 ready.

## 8. Exit Criteria for the Audit

This audit is complete when:

- every documented feature has a traceability status;
- all P0 and P1 findings include evidence, reproduction, cause, and remediation direction;
- source-of-truth conflicts are explicit rather than silently resolved;
- validation results distinguish command exit codes from actual behavioral evidence;
- the remediation order protects security and data before polish;
- no product fix or production mutation is mixed into the audit branch.

Those criteria are satisfied by this report. Product readiness is not.
