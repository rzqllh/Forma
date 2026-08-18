# Feature Specification: Export Studio

## Summary

The Export Studio allows the Owner to package and download finished photos individually or as a single combined ZIP archive. Upon export, finished photos can also be synchronized to Cloudinary storage via signed upload parameters issued by the Cloudflare Worker API, and saved to D1 as a persistent batch history record.

## User Journey

1. The Owner finishes processing photos in `/edit` and clicks "Proceed to Export" (or navigates to `/export`).
2. The Export screen displays:
   - Summary of items ready for export (count, total estimated size).
   - Format selector (Original, JPEG, PNG, WebP) and quality setting.
   - Filename template options (e.g. `{original_name}_finished`, `{client}_{index}`).
3. The Owner clicks "Download All (ZIP)" or downloads individual files.
4. For batch downloads:
   - Client-side JSZip compresses the rendered image blobs into a `.zip` archive.
   - A browser download is triggered automatically.
5. In parallel (or via "Save to History"):
   - The app requests signed upload signatures from the Worker API (`/api/upload/sign`).
   - Blobs are uploaded directly to Cloudinary storage.
   - A history row is written to D1 recording `original_filename`, `cloudinary_url`, and `operations_applied`.
6. The Export screen confirms with a success summary and button to "Return to Library" or "Start New Batch".

## Acceptance Criteria

- [ ] Single photo export triggers an instant direct file download with correct MIME type.
- [ ] Multi-photo export bundles files into a clean, uncorrupted `.zip` archive.
- [ ] Filenames in the ZIP adhere to the selected naming convention without illegal characters.
- [ ] Cloudinary uploads use secure signed parameters generated on the Worker backend without exposing API secrets.
- [ ] If Cloudinary upload fails (e.g. offline/network glitch), local ZIP download is never blocked, and an error retry badge is displayed for history sync.

## Boundary & Error Cases

- **Large ZIP archives (>500MB)**: Uses streaming blob zip generation to avoid running out of JavaScript heap memory.
- **Partial selection**: Only selected/checked photos from the batch are included in the export.

## Verification & Test Plan

- Unit test export naming and ZIP generation with sample image blobs.
- Integration test for signed Cloudinary upload params in `tests/worker-api.test.ts`.
- Manual walkthrough: full upload -> edit -> export ZIP -> confirm history record.
