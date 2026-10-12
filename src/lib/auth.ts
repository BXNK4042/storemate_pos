import bcrypt from "bcryptjs";
import getDb from "./db";
import { User } from "../../types/user";
import {
  createSessionToken,
  verifySessionToken,
  type TokenPayload,
} from "./token";

export {
  createSessionToken,
  verifySessionToken,
  type TokenPayload,
};

export async function getSessionFromRequest(req: Request): Promise<TokenPayload | null> {
  let token: string | undefined;
  const reqWithCookies = req as unknown as { cookies?: { get?: (name: string) => { value?: string } } };
  if (typeof reqWithCookies.cookies?.get === "function") {
    token = reqWithCookies.cookies.get("storemate_session")?.value;
  }
  if (!token) {
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)storemate_session=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }
  }
  if (!token) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
  }
  if (!token) return null;
  return await verifySessionToken(token);
}

export function findUserByUsername(username: string): User | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM users WHERE user_name = ?")
    .get(username) as User | undefined;
}

export function verifyAndUpgradePassword(user: User, passwordAttempt: string): boolean {
  const db = getDb();
  const storedHash = user.user_password;

  let isValid = false;
  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
    isValid = bcrypt.compareSync(passwordAttempt, storedHash);
  } else {
    // Plaintext fallback for legacy seed
    if (storedHash === passwordAttempt) {
      isValid = true;
      // Upgrade to bcrypt
      const hashed = bcrypt.hashSync(passwordAttempt, 10);
      db.prepare("UPDATE users SET user_password = ? WHERE user_id = ?").run(
        hashed,
        user.user_id
      );
    }
  }

  return isValid;
}
