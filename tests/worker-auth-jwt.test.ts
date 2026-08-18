import { describe, it, expect, beforeAll, vi } from "vitest";
import {
  verifyAuth,
  verifyCloudflareAccessJwt,
  clearJwksCache,
  AccessJsonWebKey,
} from "@/workers/api/auth";
import { Env } from "@/workers/api/index";

// Helper for base64url encoding
function base64url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const binString = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binString).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

describe("Cloudflare Access JWT & Auth Verification (P0 Remediation)", () => {
  const TEAM_DOMAIN = "forma-team";
  const POLICY_AUD = "test-policy-audience-uuid-1234";
  const ISSUER = `https://${TEAM_DOMAIN}.cloudflareaccess.com`;
  const KID = "test-key-id-1";

  let keyPair: CryptoKeyPair;
  let publicJwk: AccessJsonWebKey;

  beforeAll(async () => {
    keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"]
    );

    publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    publicJwk.kid = KID;
    publicJwk.alg = "RS256";
    publicJwk.use = "sig";
  });

  async function createSignedJwt(
    payloadOverrides: Record<string, unknown> = {},
    headerOverrides: Record<string, unknown> = {},
    signingKey: CryptoKey = keyPair.privateKey
  ): Promise<string> {
    const header = {
      alg: "RS256",
      kid: KID,
      typ: "JWT",
      ...headerOverrides,
    };

    const nowSec = Math.floor(Date.now() / 1000);
    const payload = {
      iss: ISSUER,
      aud: [POLICY_AUD],
      exp: nowSec + 3600, // +1 hour
      nbf: nowSec - 60,
      sub: "user-123",
      email: "operator@forma.internal",
      ...payloadOverrides,
    };

    const encHeader = base64url(JSON.stringify(header));
    const encPayload = base64url(JSON.stringify(payload));
    const dataToSign = new TextEncoder().encode(`${encHeader}.${encPayload}`);

    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      signingKey,
      dataToSign
    );

    const encSig = base64url(new Uint8Array(signature));
    return `${encHeader}.${encPayload}.${encSig}`;
  }

  const mockEnv: Env = {
    DB: {} as unknown as Env["DB"],
    CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
    CF_ACCESS_POLICY_AUD: POLICY_AUD,
    APP_SHARED_SECRET: "server-secret-999",
  };

  it("accepts a valid signed Cloudflare Access JWT", async () => {
    clearJwksCache();
    const token = await createSignedJwt();

    // Mock fetch to return the public JWKS
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ keys: [publicJwk] }),
      })
    );

    const req = new Request("http://localhost:8787/api/presets", {
      headers: {
        "Cf-Access-Jwt-Assertion": token,
      },
    });

    const isAuthorized = await verifyAuth(req, mockEnv);
    expect(isAuthorized).toBe(true);
  });

  it("rejects a forged / invalidly signed JWT", async () => {
    clearJwksCache();

    // Generate another attacker key
    const attackerKeyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign"]
    );

    const forgedToken = await createSignedJwt({}, {}, attackerKeyPair.privateKey);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ keys: [publicJwk] }), // Server has legitimate public key
      })
    );

    const req = new Request("http://localhost:8787/api/presets", {
      headers: {
        "Cf-Access-Jwt-Assertion": forgedToken,
      },
    });

    const isAuthorized = await verifyAuth(req, mockEnv);
    expect(isAuthorized).toBe(false);
  });

  it("rejects an expired JWT", async () => {
    clearJwksCache();
    const nowSec = Math.floor(Date.now() / 1000);
    const expiredToken = await createSignedJwt({
      exp: nowSec - 300, // Expired 5 min ago
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ keys: [publicJwk] }),
      })
    );

    const req = new Request("http://localhost:8787/api/presets", {
      headers: {
        "Cf-Access-Jwt-Assertion": expiredToken,
      },
    });

    const isAuthorized = await verifyAuth(req, mockEnv);
    expect(isAuthorized).toBe(false);
  });

  it("rejects JWT with mismatched audience", async () => {
    clearJwksCache();
    const wrongAudToken = await createSignedJwt({
      aud: ["wrong-policy-audience"],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ keys: [publicJwk] }),
      })
    );

    const req = new Request("http://localhost:8787/api/presets", {
      headers: {
        "Cf-Access-Jwt-Assertion": wrongAudToken,
      },
    });

    const isAuthorized = await verifyAuth(req, mockEnv);
    expect(isAuthorized).toBe(false);
  });

  it("rejects JWT with mismatched issuer", async () => {
    clearJwksCache();
    const wrongIssToken = await createSignedJwt({
      iss: "https://evil-team.cloudflareaccess.com",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ keys: [publicJwk] }),
      })
    );

    const req = new Request("http://localhost:8787/api/presets", {
      headers: {
        "Cf-Access-Jwt-Assertion": wrongIssToken,
      },
    });

    const isAuthorized = await verifyAuth(req, mockEnv);
    expect(isAuthorized).toBe(false);
  });

  it("rejects unverified Cf-Access-Authenticated-User-Email header without valid JWT", async () => {
    const req = new Request("http://localhost:8787/api/presets", {
      headers: {
        "Cf-Access-Authenticated-User-Email": "operator@forma.internal",
      },
    });

    const isAuthorized = await verifyAuth(req, mockEnv);
    expect(isAuthorized).toBe(false);
  });

  it("accepts valid APP_SHARED_SECRET via X-App-Secret or Bearer token", async () => {
    const req1 = new Request("http://localhost:8787/api/presets", {
      headers: {
        "X-App-Secret": "server-secret-999",
      },
    });
    expect(await verifyAuth(req1, mockEnv)).toBe(true);

    const req2 = new Request("http://localhost:8787/api/presets", {
      headers: {
        Authorization: "Bearer server-secret-999",
      },
    });
    expect(await verifyAuth(req2, mockEnv)).toBe(true);
  });

  it("rejects invalid APP_SHARED_SECRET and missing credentials", async () => {
    const req1 = new Request("http://localhost:8787/api/presets", {
      headers: {
        "X-App-Secret": "wrong-secret",
      },
    });
    expect(await verifyAuth(req1, mockEnv)).toBe(false);

    const req2 = new Request("http://localhost:8787/api/presets");
    expect(await verifyAuth(req2, mockEnv)).toBe(false);
  });
});
