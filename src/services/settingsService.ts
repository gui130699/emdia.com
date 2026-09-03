import { getDb } from "../db/database";
import { enqueueSync } from "../db/syncService";
import type { UserSettings } from "../types/finance";

export const DEFAULT_SETTINGS: UserSettings = {
  notifications: {
    email: true,
    billReminders: true,
    goalReminders: true,
    importantAlerts: true,
    promotions: false,
  },
  appearance: {
    theme: "system",
    accentColor: "#059669",
    density: "default",
  },
};

export const settingsService = {
  async get(userId: string): Promise<UserSettings> {
    const row = await getDb(userId).settings.get("current");
    if (!row?.value) return DEFAULT_SETTINGS;
    return {
      notifications: { ...DEFAULT_SETTINGS.notifications, ...row.value.notifications },
      appearance: { ...DEFAULT_SETTINGS.appearance, ...row.value.appearance },
    };
  },

  async save(userId: string, settings: UserSettings): Promise<void> {
    const updatedAt = new Date().toISOString();
    const row = { key: "current" as const, value: settings, updatedAt };
    await getDb(userId).settings.put(row);
    await enqueueSync(userId, "settings", "current", "update", row);
  },
};
