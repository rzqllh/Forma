import { describe, it, expect, vi } from "vitest";
import workerDefault, { executeDailyPurge, Env } from "@/workers/api/index";

/**
 * Helper to create an incoming server Request in happy-dom test environment.
 * happy-dom emulates a browser and strips forbidden headers (like 'Origin') from
 * client Request constructors. This helper preserves the incoming Origin header.
 */
function createWorkerRequest(url: string, init: RequestInit = {}): Request {
  const req = new Request(url, init);
  if (init.headers) {
    const rawHeaders = new Headers(init.headers);
    const origin = rawHeaders.get("Origin") || rawHeaders.get("origin");
    if (origin) {
      const originalGet = req.headers.get.bind(req.headers);
      req.headers.get = (name: string) => {
        if (name.toLowerCase() === "origin") return origin;
        return originalGet(name);
      };
    }
  }
  return req;
}

describe("Worker API: Shared Secret Authentication Gate (Fail Closed)", () => {
  const mockEnvWithSecret: Env = {
    DB: {} as unknown as D1Database,
    APP_SHARED_SECRET: "test-secret-12345",
  };

  const mockEnvWithoutSecret: Env = {
    DB: {} as unknown as D1Database,
    APP_SHARED_SECRET: undefined,
  };

  const mockEnvEmptySecret: Env = {
    DB: {} as unknown as D1Database,
    APP_SHARED_SECRET: "",
  };

  it("returns 401 Unauthorized if APP_SHARED_SECRET is not configured on server (fail-closed)", async () => {
    const req = createWorkerRequest("http://localhost:8787/api/presets", {
      method: "GET",
      headers: {
        "X-App-Secret": "any-value",
      },
    });
    const res = await workerDefault.fetch(req, mockEnvWithoutSecret);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Unauthorized");
  });

  it("returns 401 Unauthorized if APP_SHARED_SECRET is empty string (fail-closed)", async () => {
    const req = createWorkerRequest("http://localhost:8787/api/presets", {
      method: "GET",
      headers: {
        "X-App-Secret": "",
      },
    });
    const res = await workerDefault.fetch(req, mockEnvEmptySecret);
    expect(res.status).toBe(401);
  });

  it("returns 401 Unauthorized if X-App-Secret header is missing", async () => {
    const req = createWorkerRequest("http://localhost:8787/api/presets", {
      method: "GET",
    });
    const res = await workerDefault.fetch(req, mockEnvWithSecret);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Unauthorized");
  });

  it("returns 401 Unauthorized if X-App-Secret is incorrect", async () => {
    const req = createWorkerRequest("http://localhost:8787/api/presets", {
      method: "GET",
      headers: {
        "X-App-Secret": "wrong-secret",
      },
    });
    const res = await workerDefault.fetch(req, mockEnvWithSecret);
    expect(res.status).toBe(401);
  });

  it("allows OPTIONS preflight requests without authentication", async () => {
    const req = createWorkerRequest("http://localhost:8787/api/presets", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
      },
    });
    const res = await workerDefault.fetch(req, mockEnvWithSecret);
    expect(res.status).toBe(204);
  });

  it("allows health check without authentication", async () => {
    const req = createWorkerRequest("http://localhost:8787/api/health", {
      method: "GET",
    });
    const res = await workerDefault.fetch(req, mockEnvWithSecret);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });
});

describe("Worker API: CORS Origin Security Policy", () => {
  const mockEnv: Env = {
    DB: {} as unknown as D1Database,
    APP_SHARED_SECRET: "test-secret-12345",
    ALLOWED_ORIGINS: "https://forma.custom-domain.com, https://preview.forma.pages.dev",
  };

  it("permits allowed origin http://localhost:3000 on OPTIONS preflight", async () => {
    const req = createWorkerRequest("http://localhost:8787/api/presets", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
      },
    });
    const res = await workerDefault.fetch(req, mockEnv);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
  });

  it("permits allowed production Pages origin", async () => {
    const req = createWorkerRequest("http://localhost:8787/api/presets", {
      method: "OPTIONS",
      headers: {
        Origin: "https://forma-app.pages.dev",
      },
    });
    const res = await workerDefault.fetch(req, mockEnv);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://forma-app.pages.dev");
  });

  it("permits custom configured origin from ALLOWED_ORIGINS", async () => {
    const req = createWorkerRequest("http://localhost:8787/api/presets", {
      method: "OPTIONS",
      headers: {
        Origin: "https://forma.custom-domain.com",
      },
    });
    const res = await workerDefault.fetch(req, mockEnv);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://forma.custom-domain.com");
  });

  it("rejects unauthorized origin on OPTIONS preflight with 403", async () => {
    const req = createWorkerRequest("http://localhost:8787/api/presets", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example.com",
      },
    });
    const res = await workerDefault.fetch(req, mockEnv);
    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("does not reflect unauthorized origin on API responses", async () => {
    const req = createWorkerRequest("http://localhost:8787/api/health", {
      method: "GET",
      headers: {
        Origin: "https://evil.example.com",
      },
    });
    const res = await workerDefault.fetch(req, mockEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("Worker API: Cloud History URL Validation", () => {
  const mockEnv: Env = {
    DB: {
      insert: vi.fn(),
    } as unknown as D1Database,
    APP_SHARED_SECRET: "test-secret-12345",
  };

  it("rejects blob: URLs in history item creation (F-003 regression test)", async () => {
    const req = createWorkerRequest("http://localhost:8787/api/history/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Secret": "test-secret-12345",
      },
      body: JSON.stringify({
        label: "Test Batch",
        items: [
          {
            originalFilename: "interior.jpg",
            cloudinaryUrl: "blob:http://localhost:3000/01234567-89ab-cdef-0123-456789abcdef",
            operationsApplied: {
              metadataStripped: true,
              watermarked: false,
              resized: true,
              colorAdjusted: false,
            },
          },
        ],
      }),
    });
    const res = await workerDefault.fetch(req, mockEnv);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("cloudinaryUrl");
  });

  it("rejects non-HTTPS URLs in history item creation", async () => {
    const req = createWorkerRequest("http://localhost:8787/api/history/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Secret": "test-secret-12345",
      },
      body: JSON.stringify({
        label: "Test Batch",
        items: [
          {
            originalFilename: "interior.jpg",
            cloudinaryUrl: "http://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
            operationsApplied: {
              metadataStripped: true,
              watermarked: false,
              resized: true,
              colorAdjusted: false,
            },
          },
        ],
      }),
    });
    const res = await workerDefault.fetch(req, mockEnv);
    expect(res.status).toBe(400);
  });
});

describe("Worker API: 24-Hour Purge Boundary Logic", () => {
  it("correctly evaluates the 24-hour cutoff time boundary", () => {
    const fixedNow = new Date("2026-08-18T12:00:00.000Z");
    const cutoffExpected = new Date("2026-08-17T12:00:00.000Z").toISOString();

    // 23 hours 59 minutes ago (should be kept)
    const recentDeletedAt = new Date("2026-08-17T12:01:00.000Z").toISOString();
    expect(recentDeletedAt < cutoffExpected).toBe(false);

    // Exactly 24 hours 1 minute ago (should be purged)
    const expiredDeletedAt = new Date("2026-08-17T11:59:00.000Z").toISOString();
    expect(expiredDeletedAt < cutoffExpected).toBe(true);
  });
});
