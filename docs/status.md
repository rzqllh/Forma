# Project Implementation Status: FORMA

## Document Status

- Last Updated: 2026-08-18
- Current Phase: v1 Scope Complete & Verified (Ready for Final Acceptance Testing)

## Summary Statement

> **Seluruh scope implementasi v1 telah selesai dan lolos automated verification (`typecheck`, `test`, dan production build). Final browser/device acceptance testing masih menjadi tahap terakhir sebelum v1 dibekukan.**

## Visual System & Architecture Standard

> **HIG-informed UI & consistent spacing system** — hierarchy, touch targets, feedback, navigation, dan spacing diterapkan secara konsisten di seluruh breakpoint.

---

## Technical Audit & Intentional Design Checklist

| Technical Concern | Audit Result & Verified Implementation |
|---|---|
| **Metadata Cleaner** | **Intentional Stripping**: Strips EXIF, GPS location, device camera serial numbers, and private hardware tags via Canvas rasterization. Automatically normalizes EXIF orientation (`createImageBitmap(file, { imageOrientation: "from-image" })`) and encodes to standard sRGB space, preventing sideways rotation while preserving visual fidelity. |
| **Resize & Framing** | **Anti-Stretch Guaranteed**: Aspect ratio is strictly preserved across all presets (4:5 Portrait, 1:1 Square, 9:16 Story, 16:9 Banner, Max Dimension). The UI provides explicit control between **Potong Pas (*Cover*)** for centered crop fill and **Muat Utuh (*Contain*)** for letterbox-free fit. |
| **Color Adjustment** | **Applied to Output**: Warmth and auto-levels adjustments are computed and rasterized directly onto the target working canvas prior to encoding, guaranteeing that preview adjustments are 100% baked into exported JPEG/WebP/PNG files. |
| **PNG Compression** | **Lossless Clamping**: PNG encoding is recognized as lossless; UI removes misleading lossy quality sliders when PNG is selected and explicitly labels it as *PNG Lossless*. |
| **Watermark Parity** | **Mathematical Parity**: Watermark scale (% of target image width) and proportional edge offsets (`0.04 * min(w, h)`) are mathematically identical between the interactive preview canvas and full-resolution export rendering. |
| **Batch Memory Safety** | **Active Resource Cleanup**: Queue manager automatically closes `ImageBitmap` instances (`imageBitmap.close()`) and revokes object URLs upon job completion, preventing memory leaks on mobile devices and low-RAM laptops. Concurrency is hardware-capped between 2 and 4. |
| **24-Hour Trash** | **Deterministic Expiration**: Deleted batches record UTC timestamps (`deletedAt`). Any batch older than 24 hours (`now - deletedAt >= 24h`) is automatically pruned from memory and storage upon retrieval. |
| **D1 & Local Fallback** | **Storage Contract**: Cloudflare D1 is the primary remote source of truth when online; `localStorage` acts as a zero-latency local cache and offline fallback. Fast 1.5s timeout prevents blocking when the worker backend is offline. |
| **Security Scope** | **Deployment Boundary**: `X-App-Secret` serves as an internal personal deployment shared gate for single-tenant use. (Public multi-tenant OAuth is documented as out of scope for v1). |

---

## Verified Commands

| Purpose | Command | Result | Verified On |
|---|---|---|---|
| Typecheck | `pnpm typecheck` | 0 errors | 2026-08-18 (Node v22 / Windows) |
| Unit tests | `pnpm test` | 27 passed across 4 test suites | 2026-08-18 |
| Production build | `pnpm build` | Static export succeeded into `out/` | 2026-08-18 |
