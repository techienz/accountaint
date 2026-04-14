import { SignJWT, jwtVerify } from "jose";
import { v4 as uuid } from "uuid";
import { hashSync, compareSync } from "bcryptjs";
import { cookies } from "next/headers";
import { getDb, schema } from "./db";
import { eq, and } from "drizzle-orm";

const COOKIE_NAME = "session";
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

// Rate limiting
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (record && now < record.resetAt) {
    if (record.count >= 5) return false;
    record.count++;
    return true;
  }
  loginAttempts.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 });
  return true;
}

function clearRateLimit(ip: string) {
  loginAttempts.delete(ip);
}

export function hashPassword(password: string): string {
  return hashSync(password, 12);
}

export function verifyPassword(password: string, hash: string): boolean {
  return compareSync(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  const db = getDb();
  const sessionId = uuid();
  const expiresAt = new Date(Date.now() + SESSION_DURATION * 1000);

  const token = await new SignJWT({ userId, sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresAt)
    .sign(getJwtSecret());

  const { createHash } = await import("crypto");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  db.insert(schema.sessions)
    .values({
      id: sessionId,
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .run();

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION,
    secure: true,
  });

  return token;
}

export async function getSession(): Promise<{
  user: typeof schema.users.$inferSelect;
  sessionId: string;
  activeBusiness: typeof schema.businesses.$inferSelect | null;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const { userId, sessionId } = payload as {
      userId: string;
      sessionId: string;
    };

    const db = getDb();

    const session = db
      .select()
      .from(schema.sessions)
      .where(and(eq(schema.sessions.id, sessionId), eq(schema.sessions.user_id, userId)))
      .get();

    if (!session || session.expires_at < new Date()) return null;

    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .get();

    if (!user) return null;

    let activeBusiness = null;
    if (user.active_business_id) {
      activeBusiness =
        db
          .select()
          .from(schema.businesses)
          .where(
            and(
              eq(schema.businesses.id, user.active_business_id),
              eq(schema.businesses.owner_user_id, userId)
            )
          )
          .get() || null;
    }

    if (!activeBusiness) {
      activeBusiness =
        db
          .select()
          .from(schema.businesses)
          .where(eq(schema.businesses.owner_user_id, userId))
          .limit(1)
          .get() || null;

      if (activeBusiness) {
        db.update(schema.users)
          .set({ active_business_id: activeBusiness.id })
          .where(eq(schema.users.id, userId))
          .run();
      }
    }

    return { user, sessionId, activeBusiness };
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const { sessionId } = payload as { sessionId: string };
    const db = getDb();
    db.delete(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .run();
  } catch {
    // Token invalid, just clear cookie
  }

  cookieStore.delete(COOKIE_NAME);
}

export async function login(
  email: string,
  password: string,
  ip: string
): Promise<{ success: boolean; error?: string }> {
  if (!checkRateLimit(ip)) {
    return {
      success: false,
      error: "Too many login attempts. Please try again in 5 minutes.",
    };
  }

  const db = getDb();
  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase()))
    .get();

  if (!user || !verifyPassword(password, user.password_hash)) {
    return { success: false, error: "Invalid email or PIN" };
  }

  clearRateLimit(ip);
  await createSession(user.id);
  return { success: true };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!/^\d{4}$/.test(newPassword)) {
    return { success: false, error: "PIN must be exactly 4 digits" };
  }

  const db = getDb();
  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();

  if (!user) {
    return { success: false, error: "User not found" };
  }

  if (!verifyPassword(currentPassword, user.password_hash)) {
    return { success: false, error: "Current password is incorrect" };
  }

  const newHash = hashPassword(newPassword);
  db.update(schema.users)
    .set({ password_hash: newHash, updated_at: new Date() })
    .where(eq(schema.users.id, userId))
    .run();

  return { success: true };
}

export function hasUsers(): boolean {
  const db = getDb();
  const user = db.select().from(schema.users).limit(1).get();
  return !!user;
}
