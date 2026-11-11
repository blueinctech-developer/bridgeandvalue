// Password hashing with scrypt (Node built-in, no native dependencies).
import crypto from "node:crypto";

const N = 16384, r = 8, p = 1, KEYLEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, KEYLEN, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password, stored) {
  const [alg, n, rr, pp, salt, hash] = String(stored).split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64");
  const actual = crypto.scryptSync(String(password), Buffer.from(salt, "base64"), expected.length, { N: +n, r: +rr, p: +pp });
  return crypto.timingSafeEqual(expected, actual);
}

/** Minimum policy for admin passwords. Returns an error message or null. */
export function passwordProblem(pw) {
  if (typeof pw !== "string" || pw.length < 12) return "Use at least 12 characters.";
  return null;
}
