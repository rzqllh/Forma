# API Contracts: FORMA Visual Finishing API

## Overview

- Service: Cloudflare Worker API
- Base URL: `/api` (e.g. `http://localhost:8787` in local development, deployed at Worker edge)
- Authentication: Cloudflare Access (edge-injected `Cf-Access-*` identity headers) or server-to-server secret (`X-App-Secret` / `Authorization: Bearer <secret>`)
- Security boundary: Fail-closed (HTTP 401 on missing/invalid credential), strict CORS origin allowlist (HTTP 403 on unauthorized preflight)

---

## 1. System Endpoints

### `GET /api/health`
- **Auth**: Public (unauthenticated)
- **Response**: `200 OK`
  ```json
  {
    "name": "FORMA Visual Finishing API",
    "status": "ok",
    "version": "1.0.0",
    "timestamp": "2026-08-18T12:00:00.000Z"
  }
  ```

---

## 2. Presets Endpoints

### `GET /api/presets`
- **Auth**: Required
- **Response**: `200 OK`
  ```json
  {
    "presets": [
      {
        "id": "string",
        "name": "string",
        "logoUrl": "string (URL)",
        "settings": {
          "position": "bottom-right",
          "opacityPct": 80,
          "scalePct": 25,
          "rotationDeg": 0,
          "offsetX": 0,
          "offsetY": 0
        },
        "createdAt": "ISO-8601 string",
        "updatedAt": "ISO-8601 string"
      }
    ]
  }
  ```

### `POST /api/presets`
- **Auth**: Required
- **Body**:
  ```json
  {
    "name": "string (1-100 chars)",
    "logoUrl": "string (valid URL)",
    "settings": {
      "position": "top-left | top-center | top-right | center-left | center | center-right | bottom-left | bottom-center | bottom-right",
      "opacityPct": 0-100,
      "scalePct": 1-100,
      "rotationDeg": -180 to 180,
      "offsetX": "number (optional)",
      "offsetY": "number (optional)"
    }
  }
  ```
- **Response**: `201 Created` (`{ "preset": { ... } }`) or `400 Bad Request`

### `GET /api/presets/:id`
- **Auth**: Required
- **Response**: `200 OK` (`{ "preset": { ... } }`) or `404 Not Found`

### `PUT /api/presets/:id`
- **Auth**: Required
- **Body**: Partial of create schema (`name`, `logoUrl`, `settings`)
- **Response**: `200 OK` (`{ "preset": { ... } }`) or `400 / 404`

### `DELETE /api/presets/:id`
- **Auth**: Required
- **Response**: `200 OK` (`{ "success": true, "id": "presetId" }`)

---

## 3. History & Batch Endpoints

### `GET /api/history`
- **Auth**: Required
- **Query Params**: `includeDeleted=true|false`
- **Response**: `200 OK`
  ```json
  {
    "batches": [
      {
        "id": "string",
        "label": "string | null",
        "presetId": "string | null",
        "createdAt": "ISO-8601 string",
        "deletedAt": "ISO-8601 string | null",
        "items": [
          {
            "id": "string",
            "batchId": "string",
            "originalFilename": "string",
            "cloudinaryUrl": "https://...",
            "operationsApplied": {
              "metadataStripped": true,
              "watermarked": false,
              "resized": true,
              "colorAdjusted": false,
              "presetName": "string (optional)",
              "outputFormat": "image/jpeg | image/png | image/webp (optional)",
              "dimensions": { "width": 1920, "height": 1080 },
              "qualityPct": 85
            },
            "createdAt": "ISO-8601 string",
            "deletedAt": "ISO-8601 string | null"
          }
        ]
      }
    ]
  }
  ```

### `POST /api/history/batch`
- **Auth**: Required
- **Validation**:
  - `items`: array of history item descriptors
  - `cloudinaryUrl`: **must be a durable HTTPS URL** (rejects `blob:` or `http:` schemes)
- **Response**: `201 Created` (`{ "batch": { ... }, "items": [ ... ] }`) or `400 Bad Request`

### `DELETE /api/history/batch/:id`
- **Auth**: Required
- **Action**: Soft-deletes the batch and all associated history items by recording `deletedAt = now`.
- **Response**: `200 OK` (`{ "success": true, "id": "batchId", "deletedAt": "ISO string" }`)

### `POST /api/history/batch/:id/restore`
- **Auth**: Required
- **Action**: Restores the soft-deleted batch and its history items (`deletedAt = null`).
- **Response**: `200 OK` (`{ "success": true, "id": "batchId" }`)

---

## 4. Signed Upload Issuance

### `POST /api/upload/sign`
- **Auth**: Required
- **Body**: `{ "folder": "forma_photos", "publicId": "optional_id" }`
- **Response**: `200 OK`
  ```json
  {
    "signature": "sha1_hex_signature",
    "timestamp": 1723980000,
    "apiKey": "cloudinary_api_key",
    "cloudName": "mawmaw-interior",
    "folder": "forma_photos"
  }
  ```

---

## 5. Scheduled Purge Cron Job

- **Trigger**: Daily at 03:00 UTC (`cron: "0 3 * * *"`)
- **Action**: Queries batches and history items with `deletedAt < NOW() - 24 hours`, destroys associated Cloudinary assets via signed destroy API, then hard-deletes the expired D1 rows.
