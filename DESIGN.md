# Product and UI Design — Interior Photo Finisher (working name, Proposed)

This document owns information architecture, interaction behavior, visual rules, responsive behavior, accessibility, and product language.

## Document Status

- Status: Draft
- Owner: Hafizh (spec) / partner (end user)
- Last verified: 2026-08-18
- Design source or file: n/a (no visual design file yet)

## Experience Direction

- Intended feeling: fast, quiet, zero-learning-curve — closer to a phone camera-roll editor than a "creative tool." **Proposed.**
- Primary interaction style: upload → tick a few options → preview → download. No dashboards, no multi-page nav. **Confirmed** (per brief: "upload, pilih pilih opsi, tinggal download").
- Product personality: utilitarian, trustworthy, invisible — the tool should never make her second-guess whether the original design got altered. **Proposed.**
- Should resemble: iOS Photos edit screen (single image, before/after slider, a short list of adjustment sliders). **Confirmed** for the color-correction step specifically.
- Must not resemble: a "pro" photo suite (Lightroom/Capture One density) — that's the opposite of the stated goal. **Proposed.**

## Design Principles

1. `Zero manual work per photo` — every default should be "good enough to just export," options exist for the cases where it isn't.
2. `Never apply a destructive change silently` — anything that alters pixels (color correction) is preview-first, opt-in per photo or per batch.
3. `Batch is the primary use case, not the edge case` — a photoshoot produces dozens of photos at once; single-photo flow is the special case, not the default.

## Information Architecture

| Route / screen | Purpose | Allowed roles | Primary action | Entry point | Exit / next step |
|---|---|---|---|---|---|
| `/` (Upload / Library) | Drop photos in, see batch status | Owner | Upload photos | App open | Go to Edit |
| `/edit` | Apply metadata/watermark/resize/color to one photo or whole batch | Owner | Configure + apply operations | From Library, select photo(s) | Go to Export |
| `/export` | Pick output format/size, download | Owner | Download (single or ZIP) | From Edit, "Done" | Back to Library or new upload |
| `/presets` | Create/edit watermark & client presets | Owner | Save preset | From Edit panel ("Manage presets") or top nav | Back to Edit |

Navigation model:

- Global navigation: none beyond a persistent top bar (Library / Presets). This is a single-purpose tool, not a multi-section app.
- Contextual navigation: within `/edit`, a left/side panel with operation toggles (Metadata, Watermark, Resize/Compress, Color) rather than separate pages — keeps batch context visible.
- Breadcrumb or hierarchy behavior: not needed at this scale.
- Deep-link behavior: **Unknown** — does she need to reopen a past session, or is every session upload-to-download in one sitting with nothing persisted after export? This changes whether `/edit` needs a session ID at all. Flagged below as blocking.
- Back-button behavior: browser back from `/export` returns to `/edit` with settings intact (don't lose her choices).
- Unauthorized / missing-route behavior: **Proposed** — single-user tool, so likely one shared login (or none, if VPS access itself is the gate). See Open Questions.

## Critical User Flows

### Flow: Upload & Process (primary flow)

- Actor: Owner (partner)
- Entry condition: she has photos from a shoot ready to publish/send to a client
- Required data: one or more image files (JPG/PNG, camera or phone originals)

1. Drag-drop or select photos (multi-select) on `/` → thumbnail grid appears, each with a processing-queued state.
2. She selects "apply to all" or taps individual photos to customize.
3. In `/edit`, she toggles which operations run: Strip metadata (on by default), Add watermark (choose saved preset), Resize/Compress (choose social preset or custom), Color correction (off by default — see Color flow below).
4. Live thumbnail preview updates as she toggles options (watermark position, resize target).
5. She hits "Apply to batch" → each photo shows a short processing state, then a checkmark.
6. She reviews the result grid, deselects any photo she doesn't want exported.
7. She proceeds to `/export`, picks format (JPG/PNG/WebP) and confirms.
8. Single photo → direct file download. Multiple → ZIP download.

Recovery and alternate paths:

- `Photo fails to process (corrupt file, unsupported format)` → that thumbnail shows an error badge with a one-line reason; rest of batch continues unaffected.
- `She navigates away mid-batch` → **Unknown**, depends on the persistence answer above (does an in-progress batch survive a refresh?).

### Flow: Manage Watermark / Client Preset

- Actor: Owner
- Entry condition: onboarding a new client/brand, or first-time setup
- Required data: logo file (PNG, transparent background ideally)

1. Open Presets → "New preset."
2. Upload logo, set name (e.g. client name).
3. Position via drag-on-canvas + numeric opacity/scale/rotation controls, previewed on a sample photo.
4. Save → preset appears in the watermark dropdown in `/edit` from then on.

Recovery and alternate paths:

- `Logo has no transparency` → warn but don't block ("this logo has a solid background — watermark will show as a box, continue?").

### Flow: Color/Exposure Compare & Apply

- Actor: Owner
- Entry condition: within `/edit`, per photo or per batch, she opts into color correction (off by default per your brief)

1. Toggle "Auto color" on for a photo (or "apply to all").
2. App renders a before/after split-view slider (drag to compare), matching the iOS Photos edit pattern you specified.
3. An intensity slider lets her dial the correction strength up/down rather than only accept/reject the auto result.
4. "Apply" commits the adjustment to the working copy for export; original upload is never overwritten.
5. "Reset" at any point reverts to the unedited version.

Recovery and alternate paths:

- `Result looks worse than original` → Reset is always one tap away; nothing is applied until she confirms.

## Screen and Component Inventory

| Screen / component | Data source | Actions | Permissions | States required | Feature spec |
|---|---|---|---|---|---|
| Upload / Library grid | Uploaded files (session or persisted — TBD) | Upload, select, delete | Owner only | Empty, Loading, Success, Error (per-item) | Upload & Process |
| Edit panel (operation toggles) | Selected photo(s) | Toggle ops, adjust watermark/resize/color params | Owner only | Initial, Loading (applying), Success | Upload & Process |
| Before/After compare slider | Original + processed working copy | Drag to compare, adjust intensity, apply/reset | Owner only | Initial, Loading, Success | Color Compare & Apply |
| Preset manager (list + editor) | Saved presets (DB) | Create, edit, delete, drag-position logo | Owner only | Empty (no presets yet), Loading, Success, Validation error | Manage Preset |
| Export modal/screen | Selected + processed photos | Choose format/preset, download | Owner only | Loading (zipping), Success, Error | Upload & Process |

## Required States

| State | Required behavior |
|---|---|
| Initial | Library screen shows an obvious drop-zone/upload button as the only action |
| Loading | Per-photo spinner on its thumbnail during processing; batch shows an overall "3 of 12 done" counter so she isn't left guessing |
| Empty | Library empty state: "Upload photos to get started," no confusing secondary actions |
| Validation error | Preset editor: if logo upload fails or is wrong format, flag inline next to the upload field, keep her other entered settings |
| Request error | Per-photo error badge with plain-language reason ("File too large," "Unsupported format"); doesn't block the rest of the batch |
| Success | Green checkmark per processed thumbnail; export screen confirms file count and total size before download |
| Disabled | Color-correction intensity slider disabled until "Auto color" is toggled on for that photo |
| Unauthorized | **Proposed** — out of scope if single shared login; revisit if multi-user ever happens |
| Offline / timeout | Large batch uploads: show retry per failed file rather than failing the whole batch |
| Partial data | If 10 of 12 photos process successfully and 2 fail, she can still export the 10 without waiting on the 2 |
| Destructive confirmation | Deleting a saved preset asks for confirmation (used across client jobs, not easily undone) |

## Responsive and Layout Rules

- Content width and density: desktop-first working layout (she's reviewing/comparing photos, benefits from screen space); should still be usable on a tablet. **Proposed.**
- Mobile behavior: uploading from a phone (straight from camera roll) is plausible and worth supporting for the upload step at minimum; full editing on a small phone screen is not a priority for v1. **Proposed — flag if wrong.**
- Grid density: thumbnail grid reflows responsively; no fixed column count.
- Overflow / long content: long filenames truncate with ellipsis + full name on hover/tap.
- Touch target minimum: 44px, since phone upload is in scope even if full editing isn't.

## Design Tokens

Not yet defined — no visual design file exists. **Open**, not blocking for flow/IA work, but needed before implementation starts:

- Should this tool visually match the [[mawmaw-interior]] brand (forest green / pale gold, Cormorant Garamond + Josefin Sans), or is it an internal utility that can look plain/neutral since only she uses it? This is the one branding decision worth locking before UI build.

## Components and Forms

- Component library: not yet chosen — Proposed to reuse the same stack pattern as other projects for consistency (worth confirming against your usual choice, e.g. shadcn/ui).
- File upload behavior: drag-drop + click-to-browse, multi-file, show per-file progress, reject unsupported formats before upload starts (not after).
- Unsaved changes: leaving `/edit` with unapplied toggles should not silently discard a half-configured preset — warn once.
- Destructive action confirmation: preset delete only (see Required States).

## Explicitly Banned

- Auto-applying color correction without a visible before/after step — this was explicit in your brief.
- Any operation that overwrites the original uploaded file in place.
- Silent metadata stripping that also strips something she'd want kept (e.g. don't touch ICC color profile — flagged in your earlier ChatGPT excerpt, still valid here).

## Open Design Questions

| Question | Why it matters | Blocking | Owner | Needed by |
|---|---|:---:|---|---|
| Does the app need a login, or is VPS access itself the access control (single user, no public signup)? | Determines whether an auth screen/flow exists at all | Yes | Hafizh | Before ARCHITECTURE.md |
| Do processed photos/sessions persist after export, or is each session upload-to-download with nothing kept afterward? | Determines whether Library needs history, and whether refresh loses in-progress work | Yes | Hafizh | Before data-model.md |
| Should this tool visually inherit the Mawmaw Interior brand, or stay neutral/utilitarian? | Determines design tokens and whether DESIGN.md needs a full token set now or can defer | No (flow work can proceed) | Hafizh / partner | Before UI build |
| Any resolution/size ceiling on uploads (phone photos can be 40MB+ RAW-adjacent JPEGs)? | Affects VPS storage/processing limits, upload UX (progress, chunking) | No, but worth deciding early given "free priority" hosting | Hafizh | Before deployment.md |
