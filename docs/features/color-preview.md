# Feature Specification: Non-Destructive Color Preview & Adjustment

## Summary

The Color Preview feature delivers an iOS Photos-inspired visual editing experience. It enables non-destructive auto-color enhancement with a live before/after split-view slider and continuous intensity control. Color adjustments are disabled by default and require deliberate preview confirmation.

## User Journey

1. In `/edit`, "Auto Color" is toggled OFF by default.
2. When the Owner enables "Auto Color":
   - The editor displays an interactive before/after split comparison slider over the full-resolution preview.
   - The Owner drags the split handle horizontally to compare original versus adjusted pixels.
   - An Intensity slider (0% to 100%, default 70%) lets the Owner dial back subtle or bold enhancements (histogram stretching, white balance normalization, vibrance tuning).
   - "Reset" button instantly returns adjustments to 0% and disables the toggle.
3. The Owner can choose "Apply to this photo" or "Apply color adjustments to all photos in batch".
4. The original source file remains untouched in memory; all operations apply to working raster copies.

## Acceptance Criteria

- [ ] Auto-color correction algorithm analyzes luminance and RGB histograms to correct exposure balance and enhance interior warm tones cleanly.
- [ ] Before/After split slider operates smoothly at 60fps with mouse and touch events.
- [ ] Intensity slider blends smoothly between unadjusted base buffer (0%) and fully corrected buffer (100%).
- [ ] Reset action immediately reverts working copy to unadjusted state.
- [ ] Destructive silent auto-color is strictly banned; adjustments remain opt-in.

## Boundary & Error Cases

- **Already high-contrast photos**: Algorithm includes clipping guards so whites and blacks do not burn out.
- **Monochrome / low-light shots**: Histogram stretching clamps extreme adjustments to avoid color cast artifacts.

## Verification & Test Plan

- Unit test pixel manipulation functions in `lib/processing/color.ts` verifying histogram calculation and intensity interpolation.
- Manual test of before/after split slider in desktop and tablet viewports.
