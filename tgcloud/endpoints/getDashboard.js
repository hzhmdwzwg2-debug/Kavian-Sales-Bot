import { db } from 'sdk';
import { eq, desc } from 'sdk/db';
import { users, teams, customers, routePlans, routeStops, visits } from '../schema.js';
import { currentUser } from '../lib/auth.js';

export default async function getDashboard(_input = {}, ctx) {
  const actor = await currentUser(ctx);
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [allUsers, allTeams, allCustomers, allRoutes, allVisits] = await Promise.all([
    db.select().from(users).all(), db.select().from(teams).all(), db.select().from(customers).all(),
    db.select().from(routePlans).orderBy(desc(routePlans.routeDate)).limit(200).all(),
    db.select().from(visits).where(eq(visits.date, date)).all(),
  ]);
  const canSee = (teamId, repId) => actor.role === 'admin' || (actor.role === 'supervisor' && teamId === actor.teamId) || (actor.role === 'rep' && repId === actor.id);
  const routes = allRoutes.filter(r => canSee(r.teamId, r.repId));
  const activeVisits = allVisits.filter(v => canSee(v.teamId, v.repId));
  const routeDetails = [];
  for (const route of routes) {
    const stops = await db.select().from(routeStops).where(eq(routeStops.routeId, route.id)).all();
    routeDetails.push({ ...route, stops });
  }
  const todaysRoutes = routeDetails.filter(r => r.routeDate === date && r.status === 'approved');
  const plannedIds = new Set(todaysRoutes.flatMap(r => r.stops.map(s => `${r.repId}:${s.customerId}`)));
  const actualIds = new Set(activeVisits.filter(v => !v.offRoute && ['order','no_order'].includes(v.result)).map(v => `${v.repId}:${v.customerId}`));
  const completedPlanned = [...actualIds].filter(id => plannedIds.has(id)).length;
  const actualVisits = activeVisits.filter(v => ['order','no_order'].includes(v.result));
  const positive = actualVisits.filter(v => v.result === 'order').length;
  const repTeamUsers = allUsers.filter(u => u.active && (actor.role === 'admin' || u.teamId === actor.teamId));
  return {
    date, role: actor.role,
    users: repTeamUsers.map(u => ({ id: u.id, name: u.name, role: u.role, teamId: u.teamId })),
    teams: allTeams.filter(t => actor.role === 'admin' || t.id === actor.teamId),
    customers: allCustomers.filter(c => c.active),
    routes: routeDetails, visits: activeVisits,
    summary: {
      planned: plannedIds.size,
      completedPlanned,
      actual: actualVisits.length,
      positive, negative: actualVisits.length - positive,
      closed: activeVisits.filter(v => v.result === 'closed').length,
      unvisited: activeVisits.filter(v => v.result === 'not_visited').length,
      offRoute: actualVisits.filter(v => v.offRoute).length,
      amountRial: actualVisits.reduce((sum, v) => sum + (v.amountRial || 0), 0),
      routeCompletion: plannedIds.size ? Math.round(100 * completedPlanned / plannedIds.size) : 0,
      conversion: actualVisits.length ? Math.round(100 * positive / actualVisits.length) : 0,
    },
  };
}
