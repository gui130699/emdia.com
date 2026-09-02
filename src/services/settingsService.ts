import { readValue, writeValue } from "./localStore";
import type { UserSettings } from "../types/finance";

const KEY = "settings";

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
  get(userId: string): UserSettings {
    return readValue(userId, KEY, DEFAULT_SETTINGS);
  },

  save(userId: string, settings: UserSettings) {
    writeValue(userId, KEY, settings);
  },
};
