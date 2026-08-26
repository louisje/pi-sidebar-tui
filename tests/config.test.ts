import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_SIDEBAR_SETTINGS,
  loadSidebarSettings,
  saveSidebarSettings,
} from "../config.ts";

function tmpFile(): string {
  return join(mkdtempSync(join(tmpdir(), "sidebar-cfg-")), "sidebar-tui.json");
}

test("loadSidebarSettings returns defaults when file is missing", () => {
  const s = loadSidebarSettings(tmpFile());
  assert.deepEqual(s, DEFAULT_SIDEBAR_SETTINGS);
});

test("saveSidebarSettings then loadSidebarSettings round-trips", () => {
  const p = tmpFile();
  saveSidebarSettings({ enabled: false, width: 64 }, p);
  assert.deepEqual(loadSidebarSettings(p), { enabled: false, width: 64 });
});

test("saveSidebarSettings creates parent directory if missing", () => {
  const p = join(mkdtempSync(join(tmpdir(), "sidebar-cfg-")), "nested", "dir", "sidebar-tui.json");
  saveSidebarSettings({ enabled: true, width: 50 }, p);
  assert.deepEqual(loadSidebarSettings(p), { enabled: true, width: 50 });
});

test("loadSidebarSettings returns defaults for corrupt JSON", () => {
  const p = tmpFile();
  writeFileSync(p, "{not json");
  assert.deepEqual(loadSidebarSettings(p), DEFAULT_SIDEBAR_SETTINGS);
});

test("loadSidebarSettings falls back to defaults for out-of-range width", () => {
  const p = tmpFile();
  writeFileSync(p, JSON.stringify({ enabled: false, width: 999 }));
  const s = loadSidebarSettings(p);
  assert.equal(s.enabled, false);
  assert.equal(s.width, DEFAULT_SIDEBAR_SETTINGS.width);
});

test("loadSidebarSettings falls back to default width for non-integer width", () => {
  const p = tmpFile();
  writeFileSync(p, JSON.stringify({ enabled: true, width: "wide" }));
  const s = loadSidebarSettings(p);
  assert.equal(s.width, DEFAULT_SIDEBAR_SETTINGS.width);
});
