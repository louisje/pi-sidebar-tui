import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export interface SubagentEntry {
  key: string;
  agent: string;
  role?: string;
  model?: string;
  effort?: string;
  goal?: string;
  startedAt?: number;
  tokens?: { input: number; output: number; total: number };
}
export interface SubagentFleet {
  entries: SubagentEntry[];
  totalActive: number;
  omitted: number;
}

const REQUEST = "subagents:rpc:v1:request";
const READY = "subagents:rpc:v1:ready";
const STARTED = "subagent:async-started";
const COMPLETE = "subagent:async-complete";
const POLL_MS = 3000;
const RPC_TIMEOUT_MS = 2500;

export function parseFleet(value: unknown): SubagentFleet | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, any>;
  if (raw.version !== 1 || !Array.isArray(raw.entries)) return null;
  const entries: SubagentEntry[] = raw.entries.flatMap((item: any) => {
    if (!item || typeof item.key !== "string" || typeof item.agent !== "string") return [];
    const tokens = item.tokens && typeof item.tokens === "object" ? item.tokens : null;
    return [{
      key: item.key, agent: item.agent,
      role: typeof item.role === "string" ? item.role : undefined,
      model: typeof item.model === "string" ? item.model : undefined,
      effort: typeof item.effort === "string" ? item.effort : undefined,
      goal: typeof item.goal === "string" ? item.goal : undefined,
      startedAt: typeof item.startedAt === "number" && Number.isFinite(item.startedAt) ? item.startedAt : undefined,
      tokens: tokens && ["input", "output", "total"].every(k => typeof tokens[k] === "number" && Number.isFinite(tokens[k]))
        ? { input: tokens.input, output: tokens.output, total: tokens.total } : undefined,
    }];
  });
  return {
    entries,
    totalActive: Number.isSafeInteger(raw.totalActive) && raw.totalActive >= 0 ? raw.totalActive : entries.length,
    omitted: Number.isSafeInteger(raw.omitted) && raw.omitted >= 0 ? raw.omitted : 0,
  };
}

/** Optional read-only companion; no runtime import or dependency on pi-cciotti. */
export function createSubagentMonitor(pi: ExtensionAPI, onChange: (fleet: SubagentFleet | null) => void) {
  let alive = false;
  let supported = false;
  let busy = false;
  let generation = 0;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let subscriptions: Array<() => void> = [];
  let lastFleet: SubagentFleet | null = null;

  const publish = (fleet: SubagentFleet | null) => {
    lastFleet = fleet;
    onChange(fleet);
  };

  const call = (method: "ping" | "status"): Promise<any> => {
    const id = `sidebar-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve) => {
      let done = false;
      let unsubscribe: (() => void) | undefined;
      const finish = (value: unknown) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        unsubscribe?.();
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), RPC_TIMEOUT_MS);
      try {
        unsubscribe = pi.events.on(`subagents:rpc:v1:reply:${id}`, (reply: any) => finish(reply));
        pi.events.emit(REQUEST, { version: 1, requestId: id, method, params: {} });
      } catch {
        finish(null);
      }
    });
  };

  const refresh = async () => {
    if (!alive || !supported || busy) return;
    busy = true;
    const current = generation;
    try {
      const reply = await call("status");
      if (current !== generation || !alive) return;
      if (reply?.success) {
        const fleet = parseFleet(reply.data?.fleet);
        if (fleet) publish(fleet);
        else { supported = false; publish(null); }
      } // transient failure: retain last good snapshot until next poll
    } finally {
      busy = false;
    }
  };

  const discover = async () => {
    if (!alive || busy) return;
    busy = true;
    const current = generation;
    try {
      const reply = await call("ping");
      if (!alive || current !== generation) return;
      supported = !!reply?.success && reply.data?.capabilities?.fleetStatus?.version === 1;
      if (!supported) publish(null);
    } finally {
      busy = false;
    }
    if (supported && alive && current === generation) void refresh();
  };

  const scheduleRefresh = () => {
    if (!alive) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { debounceTimer = null; if (supported) void refresh(); else void discover(); }, 100);
  };

  return {
    start() {
      this.stop();
      alive = true;
      generation++;
      subscriptions = [
        pi.events.on(READY, () => void discover()),
        pi.events.on(STARTED, scheduleRefresh),
        pi.events.on(COMPLETE, scheduleRefresh),
      ];
      pollTimer = setInterval(() => { if (supported) void refresh(); else void discover(); }, POLL_MS);
      void discover();
    },
    stop() {
      alive = false;
      generation++;
      supported = false;
      busy = false;
      if (pollTimer) clearInterval(pollTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
      pollTimer = null;
      debounceTimer = null;
      for (const off of subscriptions) off();
      subscriptions = [];
      if (lastFleet !== null) publish(null);
    },
  };
}
