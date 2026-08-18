# FORMA — Visual Finishing Workspace

## Document Status

- Status: Draft
- Owner: Hafizh (Developer) / Partner (End User)
- Last verified: 2026-08-18

## Product Overview

FORMA is a single-user internal web application designed specifically for finishing interior design photos before client delivery and social publishing. It eliminates repetitive manual export workflows by allowing the owner's partner to strip private device/GPS metadata, composite client watermarks, resize and compress for web and social platforms, and visually preview non-destructive color adjustments across entire photoshoot batches.

## Goals and Non-Goals

### Product Goals
1. Provide a zero-learning-curve, camera-roll-style interface for batch photo finishing.
2. Run all compute-heavy image transformations in the browser using Canvas / Web Workers for zero server infrastructure costs and instant offline responsiveness.
3. Support reusable client/brand watermark presets to eliminate repeated positioning adjustments.
4. Provide non-destructive before/after split comparisons for color adjustments so original photos are never altered without visual confirmation.
5. Provide a 24-hour recoverable soft-delete safety net for batches and history items.

### Non-Goals (Explicit Out of Scope for v1)
- AI upscaling / AI enhancement / generative fill (explicitly deferred to v2).
- Multi-user authentication, roles, or team permissions (single owner role only).
- Server-side image rendering pipelines (Canvas/Web Worker only).
- Raw image parsing beyond standard web formats (JPG, PNG, WebP).

## User Roles

| Role | Description | Access Level |
|---|---|---|
| Owner | The single partner/operator using FORMA | Full access to upload, edit, export, manage presets, view history, and soft-delete/restore |

## Core User Journeys

1. **Batch Upload & Finishing Flow**: User drops a photoshoot batch onto the Library, configures global operations (metadata strip, watermark preset, social resize/compression), verifies live preview, processes the batch, and downloads the finalized files as a ZIP or single files.
2. **Watermark Preset Management**: User creates and tests reusable client/brand watermarks by uploading a transparent PNG logo, setting precise position/scale/opacity/rotation, and saving the preset for selection in future batches.
3. **Non-Destructive Color Adjustment**: User inspects a photo in the editor, toggles auto-color correction, uses the iOS-style before/after split slider to compare details, dials the intensity to taste, and applies it to the working copy or the entire batch.
4. **24-Hour Recovery Flow**: User accidentally deletes a photo or batch; the item moves to the recoverable Trash state where it can be restored within 24 hours before automatic scheduled purging.

## MVP Feature Matrix

| Feature | Primary Purpose | Tech Boundary |
|---|---|---|
| Metadata Cleaner | Strips EXIF/GPS/device metadata while preserving color profile | Pure Canvas buffer transfer |
| Watermark Studio | Composites brand logos with custom position, scale, opacity, rotation | Canvas 2D compositing + D1 Presets |
| Resize & Compress | Social media aspect presets + format conversion + quality compression | Canvas resampler + blob encoder |
| Color Preview | Non-destructive auto-correction with before/after split slider | Canvas pixel manipulation + UI slider |
| Batch Queue | Concurrency-limited processing pool avoiding tab freeze | Web Worker pool + `OffscreenCanvas` |
| 24h Soft-Delete & Restore | Recoverable trash window for batches and history records | D1 soft-delete + Daily Cron Trigger |
| Export Studio | Single & ZIP archive download + Cloudinary sync | JSZip + Cloudflare Worker signed API |

## Success Criteria

1. A 40-photo batch processes smoothly without browser tab crashes or memory leaks.
2. All exported photos have EXIF metadata completely stripped.
3. Watermarks composite with exact alignment and opacity as saved in presets.
4. Color adjustments remain strictly non-destructive and opt-in per photo/batch.
5. Deleted items remain restorable for 24 hours and are reliably purged thereafter.
