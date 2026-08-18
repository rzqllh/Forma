# Specification: Per-Photo Option Isolation and Interactive Crop & Pan

## 1. Problem Statement & Background

Currently, the Studio Editor (`app/edit/page.tsx`) maintains a single top-level `options` state (`const [options, setOptions] = useState<ProcessingPipelineOptions>(...)`). When switching between photos in the batch, this single shared state can inadvertently mutate or reset options across photos. Furthermore, when "Proses Semua" is triggered, `queue.updateAllJobOptions(options)` overrides every photo's custom configuration with whatever photo happened to be selected last.

To deliver professional-grade editing (Figma / Lightroom / Photoshop / MS Word style):
1. **Per-Photo Isolation**: Every photo in a batch must retain its own independent `ProcessingPipelineOptions`. Switching photos loads that photo's individual options. Modifying options updates only that photo. An explicit "Terapkan ke Semua Foto" button allows bulk synchronization intentionally.
2. **Interactive Crop & Pan**: When cropping to fixed aspect ratios (4:5, 1:1, 9:16, 16:9, or custom dimensions), users must be able to pan the crop area both via direct drag on the canvas and via precision offset sliders in the sidebar, replacing hardcoded center cropping with flexible, non-breaking optical positioning.

---

## 2. Technical Architecture & Data Flow

### 2.1 Type Definitions (`lib/processing/types.ts`)
```ts
export interface CropOffset {
  x: number; // 0 to 100% (default: 50% = center)
  y: number; // 0 to 100% (default: 50% = center)
}

export interface ResizeOptions {
  presetId: ResizePresetId;
  customWidth?: number;
  customHeight?: number;
  fitMode?: "contain" | "cover";
  cropOffset?: CropOffset;
  format: OutputFormat;
  quality: number;
}
```

### 2.2 Mathematical Model in `calculateTargetDimensions` (`lib/processing/resize.ts`)
When `fitMode === "cover"` and crop occurs:
- Horizontal shift:
  $$\text{maxShiftX} = \text{srcWidth} - \text{sW}$$
  $$\text{sX} = \text{maxShiftX} \times \left(\frac{\text{clamp}(\text{cropOffset.x}, 0, 100)}{100}\right)$$
- Vertical shift:
  $$\text{maxShiftY} = \text{srcHeight} - \text{sH}$$
  $$\text{sY} = \text{maxShiftY} \times \left(\frac{\text{clamp}(\text{cropOffset.y}, 0, 100)}{100}\right)$$
- Backward compatibility: If `cropOffset` is omitted or `{ x: 50, y: 50 }`, `sX = maxShiftX * 0.5` which exactly matches previous optical center-crop behavior.

### 2.3 Per-Photo State Synchronization (`app/edit/page.tsx`)
1. When `activeJobId` changes or photo is clicked from filmstrip:
   - Sync local `options` state from `activeJob.options`.
2. When any control is changed:
   - Update `activeJob.options` in `ProcessingQueueManager` (`queue.updateJobOptions(activeJob.id, newOptions)`).
   - Trigger debounced / instant reprocessing of `activeJob` so canvas updates live.
3. Explicit Bulk Action:
   - Add a button: `"Terapkan ke Semua Foto"` which calls `queue.updateAllJobOptions(activeJob.options)` with visual confirmation toast/badge.
4. Batch Processing:
   - `handleStartBatch` simply calls `queue.startBatch()` without overwriting each photo's custom options!

### 2.4 Canvas Interactive Drag & Pan (`app/edit/page.tsx`)
- Detect when `isCropActive` (`options.resize.fitMode === "cover"` on fixed ratio presets like 4:5, 1:1, 9:16 or custom).
- Attach pointer handlers: `onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`.
- Compute relative drag delta $\Delta X, \Delta Y$ mapped to offset percentage $[0, 100\%]$.
- Update `cropOffset` on pointer move and sync to job options.
- Provide sidebar visual sliders and quick alignment buttons (`Kiri`, `Tengah`, `Kanan` / `Atas`, `Tengah`, `Bawah`) + `Reset Posisi`.

---

## 3. Verification & Acceptance Criteria
- [ ] Switching between Photo #1 (configured with 4:5 Portrait, Crop X=20%) and Photo #2 (configured with 1:1 Square, Crop X=80%) preserves each photo's distinct options without bleed-through.
- [ ] Direct dragging on the canvas shifts the photo within the crop boundaries smoothly with visual `cursor-grab`/`cursor-grabbing`.
- [ ] Sidebar sliders accurately mirror canvas drag offset and allow numeric adjustment $[0\% - 100\%]$.
- [ ] "Terapkan ke Semua Foto" copies the active photo's settings across the entire batch when intentionally clicked.
- [ ] Export batch ZIP and single downloads preserve the individual crop offsets for each photo.
- [ ] All automated unit tests in `tests/processing.test.ts` and `tests/queue.test.ts` pass cleanly (100% pass rate).
