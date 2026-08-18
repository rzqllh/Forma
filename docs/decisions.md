# Architecture Decision Records (ADRs)

## Document Status

- Status: Living Document
- Owner: Hafizh
- Last verified: 2026-08-18

---

### ADR-001: Client-Side Canvas & Web Worker Pipeline for Image Processing

- **Status**: Confirmed
- **Context**: Interior photo finishing requires metadata stripping, watermarking, resizing, format conversion, and color preview adjustments on high-resolution camera JPEGs (up to 40MB). Server-side GPU/CPU rendering or third-party image transformation APIs would quickly exhaust free-tier quotas and incur ongoing hosting costs.
- **Decision**: Implement all image processing client-side using HTML5 Canvas 2D / `OffscreenCanvas` executed in a concurrency-limited Web Worker pool.
- **Consequences**:
  - *Positive*: Zero server compute costs; no CPU time limits; works offline; keeps original photos on the user's local device until export.
  - *Negative*: Processing performance depends on the user's local hardware. Large batches process sequentially via a queue rather than in an elastic cloud cluster.

---

### ADR-002: Cloudflare D1 and Cloudinary Separation of Concerns

- **Status**: Confirmed
- **Context**: The app requires persistence for watermark presets, batch records, and past export history. Processed images also need to be accessible if the user wishes to redownload them later.
- **Decision**: Use Cloudflare D1 (SQLite) strictly for relational metadata (`Preset`, `Batch`, `HistoryItem`) and Cloudinary strictly as storage for final exported assets via signed direct uploads.
- **Consequences**:
  - *Positive*: Keeps D1 well within its 5GB free tier; avoids hitting Cloudinary's metered transformation limits (storage-only usage); keeps API secrets off the client bundle.
  - *Negative*: Requires two cloud services (Cloudflare + Cloudinary) coordinated via a thin serverless API.

---

### ADR-003: 24-Hour Soft-Delete Window with Daily Scheduled Purge

- **Status**: Confirmed
- **Context**: Accidental batch deletion could cause data loss of finished client deliveries. However, storage on Cloudinary and D1 must not accumulate indefinitely.
- **Decision**: Soft-delete batches and history items by populating `deleted_at`. Provide a 24-hour restore window in the UI. Deploy a daily Cloudflare Cron Trigger (`0 3 * * *`) that permanently purges database rows and deletes Cloudinary assets older than 24 hours.
- **Consequences**:
  - *Positive*: Protects the user from accidental deletion while automating storage hygiene without manual maintenance.
  - *Negative*: Requires Cron Trigger handling logic in the Cloudflare Worker.

---

### ADR-004: Shared-Secret Header Gate for API Endpoints

- **Status**: Confirmed
- **Context**: Single-user internal tool with no requirement for multi-user authentication, OAuth, or password management. However, the Worker API endpoint is deployed on a public URL.
- **Decision**: Require an `X-App-Secret` HTTP header matching `APP_SHARED_SECRET` on all Worker API requests.
- **Consequences**:
  - *Positive*: Prevents casual discovery and unauthorized use of the D1 database or Cloudinary signing endpoint with zero user login friction.
  - *Negative*: Not a substitute for multi-tenant auth (acceptable for this single-user tool).

---

### ADR-005: Next.js Static Export with Tailwind CSS & shadcn/ui

- **Status**: Confirmed
- **Context**: Frontend needs high aesthetic polish (Mawmaw interior design aesthetic), smooth 60fps canvas interactions, responsive mobile/tablet/desktop layouts, and zero-configuration static deployment to Cloudflare Pages.
- **Decision**: Build using Next.js with `output: 'export'`, Tailwind CSS, and shadcn/ui components.
- **Consequences**:
  - *Positive*: Deploys effortlessly as static assets to Cloudflare Pages CDN; provides accessible UI primitives with complete design system control.
  - *Negative*: Next.js server runtime features (e.g. server actions, SSR) are not used; all backend logic lives in the Cloudflare Worker.
