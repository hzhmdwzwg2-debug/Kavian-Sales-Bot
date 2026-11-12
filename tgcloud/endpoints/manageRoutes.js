import { db, EndpointError } from 'sdk';
import { eq, and, asc, desc } from 'sdk/db';
import { users, customers, routePlans, routeStops } from '../schema.js';
import { currentUser, requireRole, positiveId, validDate, logAction } from '../lib/auth.js';

export default async function manageRoutes(input = {}, ctx) {
  const actor = await currentUser(ctx);
  const action = input.action ?? 'list';
  if (action === 'list') {
    let plans = await db.select().from(routePlans).orderBy(desc(routePlans.routeDate), desc(routePlans.id)).limit(150).all();
    if (actor.role === 'rep') plans = plans.filter(p => p.repId === actor.id);
    if (actor.role === 'supervisor') plans = plans.filter(p => p.teamId === actor.teamId);
    const full = [];
    for (const plan of plans) {
      const stops = await db.select().from(routeStops).where(eq(routeStops.routeId, plan.id)).orderBy(asc(routeStops.position)).all();
      full.push({ ...plan, stops });
    }
    return { plans: full };
  }
  if (action === 'propose') {
    requireRole(actor, 'rep');
    const routeDate = input.date;
    if (!validDate(routeDate)) throw new EndpointError('تاریخ مسیر نامعتبر است');
    const nowDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' });
    if (routeDate < nowDate) throw new EndpointError('مسیر گذشته قابل ارسال نیست');
    if (!actor.teamId) throw new EndpointError('بازاریاب به تیم تخصیص نیافته است');
    const customerIds = input.customerIds;
    if (!Array.isArray(customerIds) || customerIds.length < 1 || customerIds.length > 80) throw new EndpointError('۱ تا ۸۰ مشتری انتخاب کنید');
    const ids = customerIds.map(id => positiveId(id, 'مشتری'));
    if (new Set(ids).size !== ids.length) throw new EndpointError('مشتری تکراری در مسیر وجود دارد');
    for (const id of ids) {
      const customer = await db.select().from(customers).where(eq(customers.id, id)).get();
      if (!customer || !customer.active) throw new EndpointError(`مشتری ${id} فعال نیست`);
    }
    let plan = await db.select().from(routePlans).where(and(eq(routePlans.repId, actor.id), eq(routePlans.routeDate, routeDate))).get();
    if (plan && !['draft', 'returned'].includes(plan.status)) throw new EndpointError('برنامه ارسال یا تأیید شده و قابل تغییر نیست');
    const now = Math.floor(Date.now() / 1000);
    if (!plan) {
      [plan] = await db.insert(routePlans).values({ repId: actor.id, teamId: actor.teamId, routeDate, status: 'submitted', updatedAt: now }).returning().run();
    } else {
      await db.update(routePlans).set({ status: 'submitted', feedback: null, updatedAt: now }).where(eq(routePlans.id, plan.id)).run();
      await db.delete(routeStops).where(eq(routeStops.routeId, plan.id)).run();
    }
    await db.insert(routeStops).values(ids.map((customerId, i) => ({ routeId: plan.id, customerId, position: i + 1 }))).run();
    await logAction(actor.id, 'route', plan.id, 'submitted', { customerIds: ids });
    return { ok: true, routeId: plan.id };
  }
  if (action === 'review') {
    requireRole(actor, 'supervisor', 'admin');
    const routeId = positiveId(input.routeId);
    const plan = await db.select().from(routePlans).where(eq(routePlans.id, routeId)).get();
    if (!plan || (actor.role === 'supervisor' && plan.teamId !== actor.teamId)) throw new EndpointError('برنامه در دسترس نیست');
    if (plan.status !== 'submitted') throw new EndpointError('برنامه منتظر بررسی نیست');
    const decision = input.decision;
    if (!['approved', 'returned'].includes(decision)) throw new EndpointError('تصمیم نامعتبر');
    const feedback = String(input.feedback || '').trim().slice(0, 500);
    if (decision === 'returned' && !feedback) throw new EndpointError('دلیل برگشت الزامی است');
    await db.update(routePlans).set({ status: decision, supervisorId: actor.id, feedback: feedback || null, updatedAt: Math.floor(Date.now()/1000) }).where(eq(routePlans.id, routeId)).run();
    await logAction(actor.id, 'route', routeId, 'reviewed', { decision, feedback });
    return { ok: true };
  }
  throw new EndpointError('عملیات ناشناخته است');
}
