import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const KEY_BYTES = 64;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_BYTES);
  const hash = await deriveKey(password, salt);
  return { salt, hash };
}

export async function verifyPassword(
  password: string,
  salt: Buffer,
  expectedHash: Buffer,
) {
  const actualHash = await deriveKey(password, salt);
  return (
    actualHash.length === expectedHash.length &&
    timingSafeEqual(actualHash, expectedHash)
  );
}
