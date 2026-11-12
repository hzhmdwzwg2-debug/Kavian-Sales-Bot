import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';

export default async function onMessage(message) {
  if (message.chat?.type !== 'private' || !message.text?.startsWith('/start')) return;
  const telegramId = Number(message.from?.id);
  if (!Number.isSafeInteger(telegramId)) return;
  let user = await db.select().from(users).where(eq(users.telegramId, telegramId)).get();
  if (!user) {
    const name = `${message.from.first_name ?? ''} ${message.from.last_name ?? ''}`.trim().slice(0, 150) || 'کاربر';
    await db.insert(users).values({ telegramId, name, role: 'pending', active: false }).run();
    user = { role: 'pending', active: false, name };
  }
  const text = user.active
    ? `سلام ${user.name} 🌷\nبه سامانه فروش کاویان خوش آمدید. مینی‌اپ را از منوی بات باز کنید.`
    : `درخواست ورود شما ثبت شد.\nشناسه تلگرام: ${telegramId}\nبرای فعال‌سازی به مدیر شرکت اطلاع دهید.`;
  await api.sendMessage({ chat_id: message.chat.id, text });
}
