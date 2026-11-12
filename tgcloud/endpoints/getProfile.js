import { currentUser } from '../lib/auth.js';
export default async function getProfile(_input, ctx) {
  const user = await currentUser(ctx);
  return { id: user.id, telegramId: user.telegramId, name: user.name, role: user.role, teamId: user.teamId };
}
