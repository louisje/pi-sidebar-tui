import type { SidebarContext } from "../types.ts";
import { panelHeader, dim, trunc } from "../colors.ts";

function compact(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\\.0$/, "")}k` : String(n);
}

export function renderSubagentsPanel(ctx: SidebarContext, width: number): string[] {
  const fleet = ctx.subagents;
  if (!fleet || fleet.totalActive === 0) return [];
  const lines = [...panelHeader(`Subagents (${fleet.totalActive})`, width)];
  for (const agent of fleet.entries) {
    const started = agent.startedAt && agent.startedAt < 1e12 ? agent.startedAt * 1000 : agent.startedAt;
    const seconds = started ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : null;
    const elapsed = seconds === null ? "" : ` ${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, "0")}s`;
    lines.push(trunc(` ◐ ${agent.agent}${elapsed}`, width));
    if (agent.goal) lines.push(dim(trunc(`   ${agent.goal}`, width)));
    const detail = [agent.model, agent.effort, agent.tokens ? `${compact(agent.tokens.total)} tokens` : null].filter(Boolean).join(" · ");
    if (detail) lines.push(dim(trunc(`   ${detail}`, width)));
  }
  if (fleet.omitted) lines.push(dim(trunc(` +${fleet.omitted} more`, width)));
  return lines;
}
