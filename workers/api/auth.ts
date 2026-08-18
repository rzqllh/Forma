import { Env } from "./index";

export interface AccessJsonWebKey extends JsonWebKey {
  kid?: string;
}

interface JwksCacheEntry {
  keys: AccessJsonWebKey[];
  expiresAt: number;
}

const jwksCache = new Map<string, JwksCacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function clearJwksCache(): void {
  jwksCache.clear();
}

/**
 * Decodes a base64url string to raw Uint8Array bytes
 */
export function base64urlToBytes(base64url: string): Uint8Array {
  // Convert base64url to base64 with standard padding
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad) {
    base64 += "=".repeat(4 - pad);
  }

  const binStr = atob(base64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes a base64url string to UTF-8 text
 */
export function base64urlToString(base64url: string): string {
  const bytes = base64urlToBytes(base64url);
  return new TextDecoder().decode(bytes);
}

/**
 * Fetches and caches JWKS from Cloudflare Access certs endpoint
 */
async function getAccessJwks(teamDomain: string): Promise<AccessJsonWebKey[]> {
  const cacheKey = teamDomain.toLowerCase().trim();
  const cached = jwksCache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.keys;
  }

  const certsUrl = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`;
  const response = await fetch(certsUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS from Cloudflare Access: HTTP ${response.status}`);
  }

  const data = (await response.json()) as { keys?: AccessJsonWebKey[] };
  const keys = Array.isArray(data.keys) ? data.keys : [];

  jwksCache.set(cacheKey, {
    keys,
    expiresAt: now + CACHE_TTL_MS,
  });

  return keys;
}

/**
 * Validates and verifies Cloudflare Access RS256 JWT assertion against JWKS
 */
export async function verifyCloudflareAccessJwt(
  jwt: string,
  teamDomain: string,
  policyAud: string
): Promise<boolean> {
  try {
    const parts = jwt.trim().split(".");
    if (parts.length !== 3) {
      return false;
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // 1. Decode and validate header
    const headerJson = JSON.parse(base64urlToString(headerB64)) as {
      alg?: string;
      kid?: string;
      typ?: string;
    };

    if (headerJson.alg !== "RS256" || !headerJson.kid) {
      return false;
    }

    // 2. Decode and validate payload claims
    const payload = JSON.parse(base64urlToString(payloadB64)) as {
      iss?: string;
      aud?: string | string[];
      exp?: number;
      nbf?: number;
    };

    const nowSec = Math.floor(Date.now() / 1000);

    // Verify expiry
    if (typeof payload.exp !== "number" || payload.exp <= nowSec) {
      return false;
    }

    // Verify not before if present
    if (typeof payload.nbf === "number" && payload.nbf > nowSec + 60) {
      return false;
    }

    // Verify issuer
    const expectedIssuer = `https://${teamDomain}.cloudflareaccess.com`;
    if (payload.iss !== expectedIssuer) {
      return false;
    }

    // Verify audience
    const audMatches = Array.isArray(payload.aud)
      ? payload.aud.includes(policyAud)
      : payload.aud === policyAud;

    if (!audMatches) {
      return false;
    }

    // 3. Match Key ID in JWKS
    const keys = await getAccessJwks(teamDomain);
    const matchingKey = keys.find((k) => k.kid === headerJson.kid);
    if (!matchingKey) {
      return false;
    }

    // 4. Import RSA public key into Web Crypto
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      matchingKey,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["verify"]
    );

    // 5. Verify RS256 signature
    const dataToVerify = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signatureBytes = base64urlToBytes(signatureB64);
    const signatureBuffer = new Uint8Array(
      signatureBytes.buffer as ArrayBuffer,
      signatureBytes.byteOffset,
      signatureBytes.byteLength
    );

    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      signatureBuffer,
      dataToVerify
    );
  } catch (err) {
    console.error("JWT verification exception:", err);
    return false;
  }
}

/**
 * Authentication Gate for Worker API:
 * 1. Verifies Cloudflare Access signed JWT assertion if present and configured.
 * 2. Or validates direct server secret (X-App-Secret / Authorization Bearer).
 * 3. Fails closed (returns false) if neither is valid.
 */
export async function verifyAuth(request: Request, env: Env): Promise<boolean> {
  // 1. Cloudflare Access JWT verification
  const cfJwt =
    request.headers.get("cf-access-jwt-assertion") ||
    request.headers.get("Cf-Access-Jwt-Assertion");

  if (cfJwt && cfJwt.trim() !== "") {
    if (env.CF_ACCESS_TEAM_DOMAIN && env.CF_ACCESS_POLICY_AUD) {
      const isValid = await verifyCloudflareAccessJwt(
        cfJwt,
        env.CF_ACCESS_TEAM_DOMAIN,
        env.CF_ACCESS_POLICY_AUD
      );
      if (isValid) return true;
    }
    // If JWT was provided but was forged, expired, or configuration missing -> reject!
    return false;
  }

  // 2. Direct server/test API gate (X-App-Secret or Bearer token)
  const secretHeader = request.headers.get("X-App-Secret");
  const authHeader = request.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : null;

  const providedSecret = secretHeader || bearerToken;

  if (
    env.APP_SHARED_SECRET &&
    env.APP_SHARED_SECRET.trim() !== "" &&
    providedSecret === env.APP_SHARED_SECRET
  ) {
    return true;
  }

  // 3. Fail closed unconditionally
  return false;
}
