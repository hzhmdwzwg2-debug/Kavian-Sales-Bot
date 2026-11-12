import { db, EndpointError } from 'sdk';
import { eq, and, isNull } from 'sdk/db';
import { users, teams, memberships, customers } from '../schema.js';
import { currentUser, requireRole, positiveId, cleanText, logAction } from '../lib/auth.js';

async function exists(table, id) {
  return db.select().from(table).where(eq(table.id, id)).get();
}

export default async function manageOrganization(input = {}, ctx) {
  const actor = await currentUser(ctx);
  requireRole(actor, 'admin');
  const action = input.action ?? 'list';
  if (action === 'list') {
    const [allUsers, allTeams, allCustomers] = await Promise.all([
      db.select().from(users).all(), db.select().from(teams).all(), db.select().from(customers).all(),
    ]);
    return { users: allUsers, teams: allTeams, customers: allCustomers };
  }
  if (action === 'createTeam') {
    const name = cleanText(input.name, 100);
    if (!name) throw new EndpointError('نام تیم الزامی است');
    const [item] = await db.insert(teams).values({ name }).returning().run();
    await logAction(actor.id, 'team', item.id, 'created', { name });
    return { ok: true, item };
  }
  if (action === 'setTeamStatus') {
    const id = positiveId(input.id);
    if (!await exists(teams, id)) throw new EndpointError('تیم پیدا نشد');
    await db.update(teams).set({ active: input.active === true }).where(eq(teams.id, id)).run();
    await logAction(actor.id, 'team', id, 'set_status', { active: input.active === true });
    return { ok: true };
  }
  if (action === 'saveUser') {
    const telegramId = positiveId(input.telegramId, 'شناسه تلگرام');
    const name = cleanText(input.name, 150);
    const role = input.role;
    if (!name || !['rep', 'supervisor'].includes(role)) throw new EndpointError('نام یا نقش نامعتبر است');
    const teamId = positiveId(input.teamId, 'تیم');
    const team = await exists(teams, teamId);
    if (!team || !team.active) throw new EndpointError('تیم فعال پیدا نشد');
    const existing = await db.select().from(users).where(eq(users.telegramId, telegramId)).get();
    if (existing?.role === 'admin') throw new EndpointError('نقش مدیر از این فرم قابل تغییر نیست');
    let item;
    if (existing) {
      await db.update(users).set({ name, role, active: true, teamId }).where(eq(users.id, existing.id)).run();
      item = { ...existing, name, role, active: true, teamId };
    } else {
      [item] = await db.insert(users).values({ telegramId, name, role, active: true, teamId }).returning().run();
    }
    const prior = await db.select().from(memberships).where(and(eq(memberships.userId, item.id), isNull(memberships.endedAt))).all();
    const now = Math.floor(Date.now() / 1000);
    for (const previous of prior) {
      if (previous.teamId !== teamId) await db.update(memberships).set({ endedAt: now }).where(eq(memberships.id, previous.id)).run();
    }
    if (!prior.some(p => p.teamId === teamId)) await db.insert(memberships).values({ userId: item.id, teamId, startedAt: now }).run();
    await logAction(actor.id, 'user', item.id, 'saved', { role, teamId });
    return { ok: true, item };
  }
  if (action === 'setUserStatus') {
    const id = positiveId(input.id);
    const target = await exists(users, id);
    if (!target || target.role === 'admin') throw new EndpointError('این کاربر از این فرم قابل تغییر نیست');
    const active = input.active === true;
    await db.update(users).set({ active }).where(eq(users.id, id)).run();
    await logAction(actor.id, 'user', id, 'set_status', { active });
    return { ok: true };
  }
  if (action === 'saveCustomer') {
    const name = cleanText(input.name, 150);
    if (!name) throw new EndpointError('نام مشتری الزامی است');
    const code = cleanText(input.code, 50) || null;
    if (code && await db.select().from(customers).where(eq(customers.code, code)).get()) throw new EndpointError('کد مشتری تکراری است');
    const [item] = await db.insert(customers).values({ name, code, area: cleanText(input.area, 100), address: cleanText(input.address, 300) || null }).returning().run();
    await logAction(actor.id, 'customer', item.id, 'created');
    return { ok: true, item };
  }
  throw new EndpointError('عملیات ناشناخته است');
}
