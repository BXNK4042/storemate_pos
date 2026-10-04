import bcrypt from "bcryptjs";
import getDb from "./db";
import { User } from "../../types/user";

export {
  createSessionToken,
  verifySessionToken,
  type TokenPayload,
} from "./token";

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
