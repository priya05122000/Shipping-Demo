"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/format";
import { getPlanUsage } from "@/lib/plan-usage-api";
import type { PlanUsage, PlanUsageWindow } from "@/types/records";

/**
 * The usage of the Claude plan code generation runs on (Claude Code's login on this machine): how much of each limit
 * is used and when it resets, and, while one is reached, until when generations wait. Read again every minute while
 * shown, and with Refresh.
 */

const REFRESH_MS = 60_000;

function barColor(percent: number) {
  if (percent >= 100) return "bg-red-500";
  if (percent >= 80) return "bg-amber-500";
  return "bg-indigo-500";
}

function UsageRow({ window }: { window: PlanUsageWindow }) {
  const percent = window.utilization === null ? null : Math.round(window.utilization);
  const resets = window.resetsAt ? `resets ${formatDateTime(window.resetsAt)}` : null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-slate-700">{window.label}</span>
        <span className="text-right text-slate-500">
          {[percent === null ? "Not reported" : `${percent}% used`, resets].filter(Boolean).join(" · ")}
        </span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={window.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
      >
        {percent !== null && <div className={`h-full rounded-full ${barColor(percent)}`} style={{ width: `${Math.min(100, percent)}%` }} />}
      </div>
    </div>
  );
}

export function PlanUsagePanel() {
  const [usage, setUsage] = useState<PlanUsage>();
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);

  async function load(fresh: boolean) {
    try {
      setUsage(await getPlanUsage(fresh));
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  useEffect(() => {
    let live = true;
    const read = () =>
      getPlanUsage().then(
        (next) => {
          if (!live) return;
          setUsage(next);
          setError(undefined);
        },
        (reason) => live && setError(reason instanceof Error ? reason.message : String(reason)),
      );
    void read();
    const timer = setInterval(() => void read(), REFRESH_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  async function refresh() {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }

  const plan = usage?.subscription ? `Claude ${usage.subscription.charAt(0).toUpperCase()}${usage.subscription.slice(1)}` : "Claude plan";
  return (
    <div className="space-y-2 rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-700">{plan} usage (Claude Code)</p>
        <Button variant="ghost" size="sm" loading={refreshing} onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>
      {usage?.waitingUntil && (
        <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900 ring-1 ring-amber-200">
          The usage limit is reached: generations wait until {formatDateTime(usage.waitingUntil)}, then start again on their own.
        </p>
      )}
      {!usage && !error && <p className="text-xs text-slate-500">Reading the plan&apos;s usage…</p>}
      {(error ?? (usage && !usage.available ? usage.error : undefined)) && (
        <p className="text-xs text-slate-500">{error ?? usage?.error}</p>
      )}
      {usage?.available && usage.windows.map((window) => <UsageRow key={window.label} window={window} />)}
    </div>
  );
}
