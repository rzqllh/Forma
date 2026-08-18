# Per-Photo Option Isolation and Interactive Crop & Pan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement true per-photo option isolation across the editor batch and interactive MS Word / Figma-style crop panning (direct canvas drag & pan + precision offset sliders).

**Architecture:** Extend `ResizeOptions` with `CropOffset` (`{ x: number; y: number }`), generalize `calculateTargetDimensions` in `lib/processing/resize.ts` with bounds clamping, refactor `app/edit/page.tsx` to isolate options per photo with explicit bulk sync, and attach pointer-event crop dragging to the main canvas.

**Tech Stack:** Next.js 15 App Router, TypeScript, HTML5 Canvas 2D API, Pointer Events, Vitest.

---

### Task 1: Type System & Mathematical Model for Repositionable Crop

**Files:**
- Modify: `lib/processing/types.ts`
- Modify: `lib/processing/resize.ts`
- Test: `tests/processing.test.ts`

- [ ] **Step 1: Write failing unit tests for crop offset in `tests/processing.test.ts`**
  - Add tests verifying horizontal pan ($x=0\%$ left crop, $x=50\%$ center crop, $x=100\%$ right crop).
  - Add tests verifying vertical pan ($y=0\%$ top crop, $y=50\%$ center crop, $y=100\%$ bottom crop).
  - Add tests verifying bounds clamping for out-of-range offsets ($<0$ or $>100$).
  - Add tests verifying backward compatibility when `cropOffset` is undefined.

- [ ] **Step 2: Run tests to verify failures**
  Run: `pnpm test -- tests/processing.test.ts`

- [ ] **Step 3: Update `lib/processing/types.ts` and `lib/processing/resize.ts`**
  - Add `interface CropOffset { x: number; y: number; }`.
  - Add `cropOffset?: CropOffset` to `ResizeOptions`.
  - Update `calculateTargetDimensions` in `lib/processing/resize.ts` to compute `sX` and `sY` using `cropOffset` percentage and clamp $[0, 100]$.

- [ ] **Step 4: Run tests to verify they pass**
  Run: `pnpm test -- tests/processing.test.ts`

---

### Task 2: Per-Photo Option Isolation in Studio Editor

**Files:**
- Modify: `app/edit/page.tsx`
- Modify: `lib/queue/manager.ts`

- [ ] **Step 1: Refactor `app/edit/page.tsx` option synchronization**
  - Sync editor `options` state whenever `activeJobId` changes so it loads that specific photo's `job.options`.
  - Ensure modifying any control updates only the active job in queue manager (`queue.updateJobOptions(activeJob.id, newOptions)`).
  - Add explicit "Terapkan ke Semua Foto" (*Apply Current Settings to All*) action button with visual feedback.
  - Update `handleStartBatch` so it triggers `queue.startBatch()` without overwriting each photo's custom options.

---

### Task 3: Interactive Canvas Drag & Pan and Sidebar Precision Controls

**Files:**
- Modify: `app/edit/page.tsx`

- [ ] **Step 1: Implement Canvas Pointer Event Handlers for Direct Drag & Pan**
  - Track `isDraggingCrop`, pointer start position, and initial `cropOffset`.
  - On `pointermove`, compute drag distance mapped to percentage shift and update `cropOffset` live on the active photo.
  - Set `cursor-grab` / `cursor-grabbing` on the canvas image frame when in a crop mode.

- [ ] **Step 2: Add Sidebar Position Sliders and Quick Alignment Buttons**
  - In the "Ukuran & Rasio Foto" sidebar section, when `fitMode === "cover"`, show:
    - Position X slider (Kiri $0\%$ $\leftrightarrow$ Kanan $100\%$) if image is cropped horizontally.
    - Position Y slider (Atas $0\%$ $\leftrightarrow$ Bawah $100\%$) if image is cropped vertically.
    - Quick alignment pills (*Kiri*, *Tengah*, *Kanan* / *Atas*, *Tengah*, *Bawah*).
    - "Reset ke Tengah" button.

---

### Task 4: End-to-End Verification & Quality Gates

**Files:**
- Run: `pnpm typecheck`
- Run: `pnpm test -- --run`
- Run: `pnpm build`

- [ ] **Step 1: Run complete type check and test suites**
- [ ] **Step 2: Verify static export build**
- [ ] **Step 3: Commit and push changes to remote repository**
