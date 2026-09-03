import { getDb } from "../db/database";
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
    density: "comfortable",
  },
};

export const settingsService = {
  async get(userId: string): Promise<UserSettings> {
    const row = await getDb(userId).settings.get("current");
    return row?.value ?? DEFAULT_SETTINGS;
  },

  async save(userId: string, settings: UserSettings): Promise<void> {
    await getDb(userId).settings.put({ key: "current", value: settings });
  },
};
