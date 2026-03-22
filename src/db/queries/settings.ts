import { eq } from 'drizzle-orm';
import { db } from '../client';
import { settings } from '../schema';

export async function listSettings() {
  return db.select().from(settings);
}

export async function upsertSetting(key: string, value: string) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value },
    })
    .execute();
}

export async function upsertSettings(entries: Record<string, string>) {
  const pairs = Object.entries(entries);
  for (const [key, value] of pairs) {
    await upsertSetting(key, value);
  }
}

export async function removeSetting(key: string) {
  await db.delete(settings).where(eq(settings.key, key)).execute();
}
