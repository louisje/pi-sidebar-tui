import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";

export interface SidebarSettings {
  enabled: boolean;
  width: number;
}

export const DEFAULT_SIDEBAR_SETTINGS: SidebarSettings = { enabled: true, width: 40 };
export const MIN_SIDEBAR_WIDTH = 10;
export const MAX_SIDEBAR_WIDTH = 120;

export function sidebarConfigPath(): string {
  return join(getAgentDir(), "sidebar-tui.json");
}

export function loadSidebarSettings(path: string = sidebarConfigPath()): SidebarSettings {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return { ...DEFAULT_SIDEBAR_SETTINGS };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SIDEBAR_SETTINGS };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ...DEFAULT_SIDEBAR_SETTINGS };
  }

  const obj = parsed as Record<string, unknown>;
  const settings: SidebarSettings = { ...DEFAULT_SIDEBAR_SETTINGS };
  if (typeof obj["enabled"] === "boolean") {
    settings.enabled = obj["enabled"];
  }
  const w = obj["width"];
  if (typeof w === "number" && Number.isInteger(w) && w >= MIN_SIDEBAR_WIDTH && w <= MAX_SIDEBAR_WIDTH) {
    settings.width = w;
  }
  return settings;
}

export function saveSidebarSettings(settings: SidebarSettings, path: string = sidebarConfigPath()): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(settings, null, 2) + "\n", "utf8");
}
