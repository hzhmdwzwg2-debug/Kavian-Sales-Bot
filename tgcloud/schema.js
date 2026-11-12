import { table, integer, text, boolean, json, index, uniqueIndex, sql } from 'sdk/db';

export const teams = table('teams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
});

export const users = table('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  telegramId: integer('telegram_id').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull().default('pending'),
  active: boolean('active').notNull().default(false),
  teamId: integer('team_id'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, t => ({ teamIdx: index('idx_users_team').on(t.teamId) }));

export const memberships = table('memberships', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  teamId: integer('team_id').notNull(),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),
}, t => ({ userIdx: index('idx_memberships_user').on(t.userId) }));

export const customers = table('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').unique(),
  name: text('name').notNull(),
  area: text('area').notNull().default(''),
  phone: text('phone'),
  address: text('address'),
  active: boolean('active').notNull().default(true),
});

export const routePlans = table('route_plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  repId: integer('rep_id').notNull(),
  supervisorId: integer('supervisor_id'),
  teamId: integer('team_id').notNull(),
  routeDate: text('route_date').notNull(),
  status: text('status').notNull().default('draft'),
  feedback: text('feedback'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
}, t => ({
  uniqueRepDate: uniqueIndex('uq_route_rep_date').on(t.repId, t.routeDate),
  teamDateIdx: index('idx_route_team_date').on(t.teamId, t.routeDate),
}));

export const routeStops = table('route_stops', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  routeId: integer('route_id').notNull(),
  customerId: integer('customer_id').notNull(),
  position: integer('position').notNull(),
}, t => ({ routeIdx: index('idx_stops_route').on(t.routeId) }));

export const visits = table('visits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  repId: integer('rep_id').notNull(),
  teamId: integer('team_id').notNull(),
  routeId: integer('route_id'),
  routeStopId: integer('route_stop_id'),
  customerId: integer('customer_id').notNull(),
  date: text('date').notNull(),
  result: text('result').notNull(),
  amountRial: integer('amount_rial').notNull().default(0),
  reason: text('reason'),
  note: text('note'),
  followUpDate: text('follow_up_date'),
  offRoute: boolean('off_route').notNull().default(false),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
}, t => ({
  byRepDate: index('idx_visits_rep_date').on(t.repId, t.date),
  byTeamDate: index('idx_visits_team_date').on(t.teamId, t.date),
}));

export const auditLogs = table('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorId: integer('actor_id'),
  entity: text('entity').notNull(),
  entityId: integer('entity_id'),
  action: text('action').notNull(),
  detail: json('detail'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
});
