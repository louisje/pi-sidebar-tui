import test from "node:test";
import assert from "node:assert/strict";
import { parseFleet } from "../subagents.ts";
import { renderSubagentsPanel } from "../panels/subagents.ts";
import type { SidebarContext } from "../types.ts";

const plain = (lines: string[]) => lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");

test("fleet DTO parser accepts bounded public records", () => {
  const fleet = parseFleet({ version: 1, entries: [
    { key: "opaque-1", agent: "scout", model: "fast", goal: "Inspect code", startedAt: 1700000000,
      tokens: { input: 100, output: 20, total: 120 }, internalId: "not-public" },
    { key: 123, agent: "invalid" },
  ], totalActive: 3, omitted: 2 });
  assert.equal(fleet?.entries.length, 1);
  assert.equal(fleet?.entries[0]?.agent, "scout");
  assert.equal(fleet?.omitted, 2);
  assert.ok(!("internalId" in fleet!.entries[0]!));
});
test("unsupported fleets are rejected", () => {
  assert.equal(parseFleet({ version: 2, entries: [] }), null);
  assert.equal(parseFleet({ version: 1, entries: null }), null);
});
test("optional panel hides when service absent or idle", () => {
  assert.deepEqual(renderSubagentsPanel({ subagents: null } as SidebarContext, 40), []);
  assert.deepEqual(renderSubagentsPanel({ subagents: { entries: [], totalActive: 0, omitted: 0 } } as SidebarContext, 40), []);
});
test("active panel displays agent goal, tokens and overflow", () => {
  const ctx = { subagents: { entries: [{ key: "x", agent: "reviewer", goal: "Check a diff", model: "gpt",
    tokens: { input: 900, output: 200, total: 1100 } }], totalActive: 2, omitted: 1 } } as SidebarContext;
  const text = plain(renderSubagentsPanel(ctx, 50));
  assert.match(text, /Subagents \(2\)/);
  assert.match(text, /reviewer/);
  assert.match(text, /Check a diff/);
  assert.match(text, /1.1k tokens/);
  assert.match(text, /\+1 more/);
});
