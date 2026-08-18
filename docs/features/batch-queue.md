# Feature Specification: Concurrency-Limited Batch Queue

## Summary

The Batch Queue manages processing workflows for photoshoot batches containing up to 50+ high-resolution photos. To prevent main thread freezing, browser tab crashes, and memory exhaustion, jobs are scheduled through a concurrency-limited pool of Web Workers running `OffscreenCanvas`.

## User Journey

1. The Owner selects or drops multiple photos (JPEG, PNG, WebP) on `/`.
2. Each file is validated (MIME type check, magic byte sanity, size check).
3. The queue assigns each photo an initial state: `queued`.
4. The queue pool dynamically checks `navigator.hardwareConcurrency` (defaulting to 2-3 concurrent workers) and dispatches items sequentially.
5. In the UI:
   - Overall batch progress displays "X of N completed" with a progress bar.
   - Each thumbnail displays its live state badge: `queued` (clock), `processing` (spinner), `done` (green checkmark), or `error` (warning badge with message).
6. Upon job completion, the worker transfers output Blobs and thumbnail buffers back to the main thread.
7. Object URLs and intermediate canvas buffers are promptly garbage-collected (`URL.revokeObjectURL`).
8. If any single photo fails, remaining items continue processing without interruption.

## Acceptance Criteria

- [ ] Worker pool concurrency is capped at `Math.min(4, Math.max(2, navigator.hardwareConcurrency - 1))`.
- [ ] Every job transitions through deterministic states: `queued` -> `processing` -> `done` or `error`.
- [ ] Memory leaks are prevented by explicitly revoking object URLs after jobs complete.
- [ ] Partial failure is supported: successful photos in a batch are ready for export even if some fail.
- [ ] Main UI remains responsive (60fps scrolling, instant button feedback) during heavy batch processing.

## Boundary & Error Cases

- **Corrupt or unreadable file**: Fails cleanly with an error state on that item only; logs diagnostic info without throwing uncaught exceptions.
- **Hardware concurrency unavailable**: Safely defaults concurrency to 2.
- **User cancels batch in progress**: Worker tasks terminate cleanly and free canvas buffers.

## Verification & Test Plan

- Unit test queue logic in `tests/queue.test.ts` with mock workers, validating concurrency limits, sequential processing, and partial failure recovery.
