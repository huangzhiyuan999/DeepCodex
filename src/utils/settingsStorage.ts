import { defaultSettings } from "../data/mockData";
import type { ApiSettings } from "../api/types";

const storageKey = "deepclaude.api";

export function loadSettings(): ApiSettings {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return defaultSettings;

  try {
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    localStorage.removeItem(storageKey);
    return defaultSettings;
  }
}

export function saveSettings(settings: ApiSettings): void {
  localStorage.setItem(storageKey, JSON.stringify(settings));
}
