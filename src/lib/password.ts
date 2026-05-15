// Password hashing via Web Crypto (PBKDF2-SHA-256). Zero dependencies.
//
// Storage format: pbkdf2$<iterations>$<base64-salt>$<base64-derived-key>
// Iteration count lives in the string so we can bump it later without
// invalidating existing hashes.

const ITERATIONS = 600_000; // OWASP 2023 minimum for PBKDF2-SHA-256
const KEY_LENGTH_BYTES = 32;
const SALT_LENGTH_BYTES = 16;

export const PASSWORD_RULES =
  "Use at least 8 characters with a mix of letters and numbers.";

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 200) return "Password is too long.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must include at least one letter and one number.";
  }
  return null;
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_LENGTH_BYTES * 8
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(SALT_LENGTH_BYTES);
  crypto.getRandomValues(salt);
  const key = await deriveKey(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(key)}`;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number.parseInt(parts[1]!, 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = fromBase64(parts[2]!);
  const expected = fromBase64(parts[3]!);
  const candidate = await deriveKey(password, salt, iterations);
  return timingSafeEqual(candidate, expected);
}
