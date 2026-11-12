import { db, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { users, auditLogs } from '../schema.js';

export async function currentUser(ctx) {
  const telegramId = Number(ctx?.initData?.user?.id);
  if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
    throw new EndpointError('ورود معتبر تلگرام لازم است', { code: 'UNAUTHORIZED' });
  }
  const user = await db.select().from(users).where(eq(users.telegramId, telegramId)).get();
  if (!user || !user.active || user.role === 'pending') {
    throw new EndpointError('حساب شما هنوز توسط مدیر فعال نشده است', { code: 'NOT_ACTIVE' });
  }
  return user;
}
export function requireRole(user, ...allowed) {
  if (!allowed.includes(user.role)) throw new EndpointError('مجوز انجام این عملیات را ندارید', { code: 'FORBIDDEN' });
}
export async function logAction(actorId, entity, entityId, action, detail = null) {
  await db.insert(auditLogs).values({ actorId, entity, entityId, action, detail }).run();
}
export function positiveId(value, label = 'شناسه') {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new EndpointError(`${label} نامعتبر است`, { code: 'INVALID_INPUT' });
  return n;
}
export function cleanText(value, max = 150) {
  return String(value ?? '').trim().slice(0, max);
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().startsWith(value);
}
