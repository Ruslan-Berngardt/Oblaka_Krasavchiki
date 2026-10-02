import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(':');
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(Buffer.from(expected, 'hex'), actual);
}
export const cookieOptions = () => ({
  httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', path: '/',
});
export async function startSession(db, res, userId) {
  const token = randomBytes(32).toString('hex');
  await db.query("INSERT INTO sessions(token_hash, user_id, expires_at) VALUES($1,$2,now() + interval '7 days')", [tokenHash(token), userId]);
  res.cookie('kadr_session', token, { ...cookieOptions(), maxAge: 7 * 86400000 });
}
