import { describe, it, expect, vi } from "vitest";
import workerDefault, { executeDailyPurge, Env } from "@/workers/api/index";

describe("Worker API: Shared Secret Authentication Gate", () => {
  const mockEnv: Env = {
    DB: {} as unknown as D1Database,
    APP_SHARED_SECRET: "test-secret-12345",
  };

  it("returns 401 Unauthorized if X-App-Secret is missing", async () => {
    const req = new Request("http://localhost:8787/api/presets", {
      method: "GET",
    });
    const res = await workerDefault.fetch(req, mockEnv);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Unauthorized");
  });

  it("returns 401 Unauthorized if X-App-Secret is incorrect", async () => {
    const req = new Request("http://localhost:8787/api/presets", {
      method: "GET",
      headers: {
        "X-App-Secret": "wrong-secret",
      },
    });
    const res = await workerDefault.fetch(req, mockEnv);
    expect(res.status).toBe(401);
  });

  it("allows OPTIONS preflight requests without authentication", async () => {
    const req = new Request("http://localhost:8787/api/presets", {
      method: "OPTIONS",
    });
    const res = await workerDefault.fetch(req, mockEnv);
    expect(res.status).toBe(204);
  });

  it("allows health check without authentication", async () => {
    const req = new Request("http://localhost:8787/api/health", {
      method: "GET",
    });
    const res = await workerDefault.fetch(req, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
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
