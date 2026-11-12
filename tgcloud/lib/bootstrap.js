// CLI-ONLY ADMIN BOOTSTRAP. This module is deliberately NOT an endpoint or handler.
// Run using an authenticated tgcloud CLI after schema migration. Never expose publicly.
import { db } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';
export default async function bootstrap(input = {}) {
  const telegramId = Number(input.telegramId);
  if (!Number.isSafeInteger(telegramId) || telegramId <= 0) throw new Error('Valid numeric telegramId required');
  const name = String(input.name || 'مدیر کاویان').trim().slice(0, 150);
  const existing = await db.select().from(users).where(eq(users.telegramId, telegramId)).get();
  if (existing) {
    await db.update(users).set({ role: 'admin', active: true, name }).where(eq(users.id, existing.id)).run();
  } else {
    await db.insert(users).values({ telegramId, name, role: 'admin', active: true }).run();
  }
  return { ok: true, telegramId, role: 'admin' };
}
