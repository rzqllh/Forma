# Feature Specification: 24-Hour Soft-Delete & Restore

## Summary

The 24-Hour Soft-Delete and Restore feature provides a safety net against accidental deletions. When a batch or history item is deleted in the UI, its `deleted_at` timestamp is set rather than immediately hard-deleting the row. Users can view and restore deleted items within 24 hours. After 24 hours, a scheduled Cloudflare Cron Trigger permanently purges expired rows and their associated Cloudinary storage assets.

## User Journey

1. **Deleting an Item / Batch**:
   - The Owner clicks "Delete" on a batch or photo record in the Library / History view.
   - A confirmation dialog appears ("Move to Trash? Recoverable for 24 hours").
   - The item is removed from the active Library view and tagged with `deleted_at = ISO timestamp`.
2. **Restoring from Trash**:
   - The Owner opens the "Trash" panel in the Library.
   - Deleted items are displayed along with a countdown of remaining hours/minutes (e.g. "Expires in 18h 42m").
   - The Owner clicks "Restore"; `deleted_at` is set back to `NULL`, and the item reappears in the active Library.
3. **Automated Daily Purge**:
   - Every day at 03:00 UTC, a Cloudflare Cron Trigger fires.
   - The handler queries D1 for records where `deleted_at < datetime('now', '-24 hours')`.
   - The worker calls the Cloudinary Admin API to delete the remote assets.
   - D1 rows for expired `HistoryItem` and `Batch` records are hard-deleted.

## Acceptance Criteria

- [ ] Deleting a batch sets `deleted_at` on the `Batch` and cascade-marks child `HistoryItem` rows.
- [ ] Restoring a batch sets `deleted_at = NULL` on the batch and its child items.
- [ ] Items in the Trash panel show an accurate live countdown timer.
- [ ] The purge Cron Trigger identifies only items deleted > 24 hours ago (boundary check: 23h59m is kept, 24h01m is purged).
- [ ] Cloudinary asset deletions are executed safely in batches before database row deletion.

## Boundary & Error Cases

- **Cloudinary deletion error during purge**: If Cloudinary API fails on an asset, the error is caught and logged, and the purge continues for other records.
- **Immediate manual purge**: Not exposed in UI for v1 to ensure the 24-hour safety window remains strictly enforceable.

## Verification & Test Plan

- Unit test the time boundary query with an injectable mock clock in `tests/worker-api.test.ts`.
- Manual acceptance test: Delete batch -> verify trash view -> restore -> verify active view.
