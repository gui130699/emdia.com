import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../contexts/AuthContext";
import { settingsService, DEFAULT_SETTINGS } from "../services/settingsService";
import type { AppearancePreferences, NotificationPreferences, UserSettings } from "../types/finance";

interface SettingsValue {
  settings: UserSettings;
  updateNotifications: (patch: Partial<NotificationPreferences>) => void;
  updateAppearance: (patch: Partial<AppearancePreferences>) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

let systemThemeQuery: MediaQueryList | null = null;
let systemThemeListener: ((e: MediaQueryListEvent) => void) | null = null;

function applyTheme(theme: AppearancePreferences["theme"]) {
  const root = document.documentElement;

  if (systemThemeQuery && systemThemeListener) {
    systemThemeQuery.removeEventListener("change", systemThemeListener);
    systemThemeQuery = null;
    systemThemeListener = null;
  }

  if (theme === "system") {
    systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    root.classList.toggle("dark", systemThemeQuery.matches);
    systemThemeListener = (e) => root.classList.toggle("dark", e.matches);
    systemThemeQuery.addEventListener("change", systemThemeListener);
  } else {
    root.classList.toggle("dark", theme === "dark");
  }
}

function applyDensity(density: AppearancePreferences["density"]) {
  document.documentElement.setAttribute("data-density", density);
}

function applyAccent(color: string) {
  document.documentElement.style.setProperty("--accent", color);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.uid ?? "";
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!userId) return;
    const loaded = settingsService.get(userId);
    setSettings(loaded);
    applyTheme(loaded.appearance.theme);
    applyDensity(loaded.appearance.density);
    applyAccent(loaded.appearance.accentColor);
  }, [userId]);

  const value = useMemo<SettingsValue>(
    () => ({
      settings,
      updateNotifications(patch) {
        const next = { ...settings, notifications: { ...settings.notifications, ...patch } };
        setSettings(next);
        if (userId) settingsService.save(userId, next);
      },
      updateAppearance(patch) {
        const next = { ...settings, appearance: { ...settings.appearance, ...patch } };
        setSettings(next);
        if (userId) settingsService.save(userId, next);
        if (patch.theme) applyTheme(next.appearance.theme);
        if (patch.density) applyDensity(next.appearance.density);
        if (patch.accentColor) applyAccent(next.appearance.accentColor);
      },
    }),
    [settings, userId]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
