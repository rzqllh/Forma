# Feature Specification: Resize & Compression Studio

## Summary

The Resize & Compression feature provides optimized dimension presets for social media platforms (Instagram Feed, Story/Reels, Website Portfolio, High-Res Print), customizable dimensions, output format conversion (JPEG, PNG, WebP), and fine-grained quality compression control.

## User Journey

1. In `/edit`, the Owner enables "Resize & Compress".
2. The Owner selects a size preset from options:
   - **Original Dimensions** (no resize, compression only)
   - **Instagram Portrait** (1080 x 1350 px, 4:5 aspect)
   - **Instagram Square** (1080 x 1080 px, 1:1 aspect)
   - **Instagram Story / Reels** (1080 x 1920 px, 9:16 aspect)
   - **Web Portfolio** (2048 px max width/height, preserve aspect)
   - **Client Delivery HD** (2560 px max edge, 85% quality)
   - **Custom Dimensions** (explicit width/height with aspect lock option)
3. The Owner selects fit mode: `contain` (fit inside bounds) or `cover` (smart crop to exact aspect).
4. The Owner selects output format: `image/jpeg`, `image/png`, or `image/webp`.
5. The Owner adjusts the quality slider (30% to 100%, default 85%).
6. Live estimated file size and dimensions are displayed.

## Acceptance Criteria

- [ ] All social media and web presets compute correct target dimensions with aspect ratio preservation.
- [ ] Canvas bicubic interpolation delivers crisp downsampling without jagged artifacts.
- [ ] Compression slider maps accurately to Canvas `toBlob(type, quality)` parameters.
- [ ] Target dimensions never upscale an original image unless explicitly requested.
- [ ] Live preview updates promptly upon preset or slider changes.

## Boundary & Error Cases

- **Very small images**: If source image is smaller than target preset, downsampling is bypassed or scaled smoothly without blur.
- **Extreme quality setting**: 100% quality preserves high-fidelity details; low quality (e.g. 40%) optimizes size for quick previews.
- **PNG transparency with JPEG export**: Canvas automatically blends transparent backgrounds onto a clean white background rather than corrupting black pixels.

## Verification & Test Plan

- Unit test `lib/processing/resize.ts` verifying output dimensions, aspect ratio calculations, format headers, and blob size compression in `tests/processing.test.ts`.
