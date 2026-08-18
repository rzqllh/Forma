# Feature Specification: Metadata Cleaner

## Summary

The Metadata Cleaner removes all private and unnecessary EXIF, GPS, camera model, date-time, and device metadata from uploaded interior design photos before client delivery or social media publishing. It operates client-side via HTML5 Canvas rasterization without sending unstripped photos over the network.

## User Journey

1. The Owner drops photos into the upload library.
2. In the Edit panel, "Strip metadata" is enabled by default.
3. During batch or single photo processing, image raster data is transferred to a fresh canvas/OffscreenCanvas context, rendering pure pixel data and discarding all original metadata headers (EXIF, IPTC, XMP, GPS coordinates).
4. The output image is re-encoded as a clean JPEG/PNG/WebP blob.
5. In the export preview, metadata status confirms "Cleaned (EXIF/GPS removed)".

## Acceptance Criteria

- [ ] All EXIF segments (e.g. GPS coordinates, Camera make/model, Exposure parameters, Serial numbers) are completely stripped from exported files.
- [ ] ICC color profile data and visual color rendering are preserved during canvas re-encoding.
- [ ] Metadata stripping is non-destructive to the source file loaded in memory.
- [ ] Stripping is active by default for all new batches.
- [ ] Processing runs within milliseconds per photo on standard hardware.

## Boundary & Error Cases

- **Already-clean images**: Processing an image that has no EXIF headers succeeds without degradation.
- **Corrupt EXIF headers**: If an image contains malformed metadata, Canvas decoding ignores corrupt segments and outputs a valid clean bitmap.
- **Oversized files (~40MB)**: Canvas safely draws image bitmaps without memory leaks; object URLs are cleaned up.

## Verification & Test Plan

- Unit test with a sample JPEG containing known GPS and camera EXIF tags, verifying that reading EXIF after processing returns empty/null tags.
- Verified in `tests/processing.test.ts`.
