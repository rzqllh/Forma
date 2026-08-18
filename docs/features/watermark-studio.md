# Feature Specification: Watermark Studio & Client Presets

## Summary

Watermark Studio allows the Owner to composite client and brand watermark logos over photoshoot images. It provides visual positioning tools (anchor grid, offsets, scale, opacity, rotation) and saves these settings as reusable named Presets in Cloudflare D1 so client-specific branding can be applied to an entire batch in a single click.

## User Journey

1. **Creating/Editing a Preset**:
   - The Owner navigates to `/presets` or clicks "Manage Presets" in the Edit sidebar.
   - The Owner uploads a logo (PNG with transparency recommended).
   - The Owner assigns a preset name (e.g. "Villa Serenity - Dark Logo").
   - The Owner adjusts controls:
     - Anchor position: 9-point grid (Top-Left, Top-Center, Top-Right, Center-Left, Center, Center-Right, Bottom-Left, Bottom-Center, Bottom-Right).
     - Margin / Offset: X and Y padding from image borders (0% to 50%).
     - Scale: 1% to 100% relative to target image width.
     - Opacity: 0% to 100%.
     - Rotation: -180° to +180°.
   - A live interactive canvas previews the watermark over a sample photo.
   - The Owner clicks "Save Preset" to persist to D1.
2. **Applying to Batch / Photo**:
   - In `/edit`, the Owner toggles "Watermark" on.
   - The Owner selects the saved preset from the dropdown.
   - The live thumbnail updates immediately.
   - When "Apply to Batch" is clicked, all photos receive the composite watermark.

## Acceptance Criteria

- [ ] Presets persist in Cloudflare D1 with fields: `id`, `name` (unique), `logo_url`, `settings` (JSON), `created_at`, `updated_at`.
- [ ] Setting values are constrained: `opacityPct` (0–100), `scalePct` (1–100), `rotationDeg` (-180 to 180).
- [ ] Non-transparent logo upload triggers a non-blocking warning ("This logo has a solid background").
- [ ] Compositing math accurately handles landscape, portrait, and square orientations.
- [ ] Deleting a preset requires confirmation and sets `Batch.preset_id` to NULL without deleting batch history.

## Boundary & Error Cases

- **Logo fails to load**: If a logo URL is unreachable, processing falls back gracefully with a per-photo error badge without halting the queue.
- **Extreme aspect ratios**: Ultra-wide panoramas or tall crops calculate scale based on the bounding dimension, preventing logo clipping.
- **Duplicate preset names**: Blocked client-side and server-side with inline validation.

## Verification & Test Plan

- Unit test `lib/processing/watermark.ts` compositing logic with 9 anchor positions and various opacities.
- API integration tests for CRUD `/api/presets`.
