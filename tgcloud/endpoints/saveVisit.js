import { db, EndpointError } from 'sdk';
import { eq, and } from 'sdk/db';
import { visits, customers, routePlans, routeStops } from '../schema.js';
import { currentUser, requireRole, positiveId, validDate, cleanText, logAction } from '../lib/auth.js';

export default async function saveVisit(input = {}, ctx) {
  const actor = await currentUser(ctx);
  requireRole(actor, 'rep');
  if (!actor.teamId) throw new EndpointError('ابتدا باید به یک تیم اضافه شوید');
  const customerId = positiveId(input.customerId, 'مشتری');
  const customer = await db.select().from(customers).where(eq(customers.id, customerId)).get();
  if (!customer || !customer.active) throw new EndpointError('مشتری پیدا نشد');
  const date = input.date;
  if (!validDate(date)) throw new EndpointError('تاریخ نامعتبر است');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' });
  if (date !== today) throw new EndpointError('گزارش فقط برای روز جاری قابل ثبت است');
  const result = input.result;
  if (!['order', 'no_order', 'closed', 'not_visited'].includes(result)) throw new EndpointError('نتیجه مراجعه نامعتبر است');
  const amountRial = result === 'order' ? Number(input.amountRial) : 0;
  if (!Number.isSafeInteger(amountRial) || amountRial < 0 || (result === 'order' && amountRial <= 0)) throw new EndpointError('مبلغ سفارش باید عدد صحیح ریالی مثبت باشد');
  const reason = cleanText(input.reason, 150) || null;
  if (result === 'no_order' && !reason) throw new EndpointError('دلیل عدم سفارش الزامی است');
  const followUpDate = input.followUpDate || null;
  if (followUpDate && !validDate(followUpDate)) throw new EndpointError('تاریخ پیگیری نامعتبر است');
  const plan = await db.select().from(routePlans).where(and(eq(routePlans.repId, actor.id), eq(routePlans.routeDate, date), eq(routePlans.status, 'approved'))).get();
  let matched = null;
  if (plan) matched = await db.select().from(routeStops).where(and(eq(routeStops.routeId, plan.id), eq(routeStops.customerId, customerId))).get();
  const offRoute = !matched;
  if (result === 'not_visited' && offRoute) throw new EndpointError('عدم مراجعه فقط برای مشتریان برنامه ثبت می‌شود');
  if (matched) {
    const existing = await db.select().from(visits).where(and(eq(visits.routeStopId, matched.id), eq(visits.repId, actor.id))).get();
    if (existing) throw new EndpointError('نتیجه این مشتری در مسیر قبلاً ثبت شده است');
  }
  const [visit] = await db.insert(visits).values({
    repId: actor.id, teamId: actor.teamId, routeId: plan?.id ?? null,
    routeStopId: matched?.id ?? null, customerId, date, result, amountRial,
    reason, note: cleanText(input.note, 600) || null,
    followUpDate, offRoute,
  }).returning().run();
  await logAction(actor.id, 'visit', visit.id, 'created', { customerId, result, offRoute });
  return { ok: true, visitId: visit.id, offRoute };
}
