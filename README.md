# FORMA

**Refine without redesigning.**

FORMA is a visual finishing workspace for designers who need to prepare, clean, and refine their visual assets without changing the original design.

Built initially around interior design workflows, FORMA handles the repetitive work that usually happens after a render or photoshoot: removing sensitive metadata, applying client watermarks, resizing images, making light visual adjustments, and exporting finished assets in batches.

## What FORMA Does

* **Metadata Cleanup**
  Remove EXIF, GPS, camera information, and other unnecessary metadata before sharing files while preserving visual color fidelity.

* **Watermark Studio**
  Apply logo watermarks with configurable position, scale, opacity, and rotation.

* **Client Presets**
  Save reusable watermark configurations for different clients and projects.

* **Resize & Compression**
  Prepare images for common social media, web, and custom dimensions with explicit framing control (Cover/Contain).

* **Non-Destructive Adjustments**
  Fine-tune warmth, brightness, contrast, and saturation without modifying the original file.

* **Batch Processing**
  Process multiple images while keeping browser memory usage controlled.

* **Export Workspace**
  Export finished images individually or as a ZIP archive.

* **Local-First Processing**
  Core image processing happens directly on the user's device.

## Philosophy

FORMA is not intended to redesign creative work.

The original composition, geometry, materials, and design decisions remain the source of truth. FORMA exists as the finishing layer between the completed work and the files that are ultimately delivered, published, or archived.

> **Refine the finish. Preserve the form.**

## Current Scope

FORMA v1 focuses on lightweight, deterministic visual finishing:

* Metadata cleanup
* Watermarking
* Resize and compression
* Basic color adjustments
* Batch processing
* Presets
* ZIP export
* Export history and temporary trash recovery

AI-powered enhancement and artifact correction are intentionally outside the v1 scope.

## Privacy

FORMA is designed around local-first image processing.

Sensitive image operations are performed in the browser whenever possible, reducing the need to upload original project assets to external processing services.

Metadata should still be reviewed before publishing files that contain sensitive information.

## Tech

FORMA is built with:

* Next.js (App Router, Static Export)
* Browser Canvas & ImageBitmap APIs
* JSZip
* Cloudflare D1 for persistent workspace data & sync
* Tailwind CSS & Heroicons

## Status

**v1 MVP — feature complete**

The current implementation has passed:

* Type checking (`pnpm typecheck`)
* Automated unit tests (`pnpm test`)
* Production build verification (`pnpm build`)

Device and real-world image acceptance testing should still be performed before relying on FORMA for critical production workflows.

## Roadmap

Future versions may explore:

* AI-assisted upscale and enhancement
* AI artifact correction
* Geometry and material consistency checks
* Original-design protection
* More advanced export workflows

These features should follow the same core principle: improve presentation without silently redesigning the source work.

## License

MIT License
