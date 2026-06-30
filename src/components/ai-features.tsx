import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import confetti from "canvas-confetti";
import { AlertOctagon, ShieldAlert, Sun, Zap, Heart, Activity, Brain } from "lucide-react";
import { GlassCard, SectionTitle, RiskBadge, fmtCountdown } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { explainCritical, hoursUntil, confidenceColor, completionProbability } from "@/lib/risk";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function fireConfetti() {
  try {
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors: ["#a78bfa", "#22d3ee", "#34d399", "#fbbf24"] });
    setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0, y: 0.7 } }), 150);
    setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1, y: 0.7 } }), 250);
  } catch {}
}

export function CountdownRing({ deadline, size = 140 }: { deadline: string | null; size?: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!deadline) return null;
  const hrs = hoursUntil(deadline);
  const total = 72; // 3-day reference window
  const pct = hrs < 0 ? 1 : Math.max(0, Math.min(1, hrs / total));
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const color = hrs < 0 ? "stroke-destructive" : hrs < 6 ? "stroke-destructive" : hrs < 24 ? "stroke-amber-400" : "stroke-emerald-400";
  const ms = new Date(deadline).getTime() - Date.now();
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const label = h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} className="stroke-white/10" strokeWidth={6} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={color + " transition-[stroke-dashoffset] duration-700"}
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center px-2 leading-tight">
        <div className={"text-[10px] uppercase tracking-widest " + (overdue ? "text-destructive" : "text-muted-foreground")}>
          {overdue ? "overdue by" : "remaining"}
        </div>
        <div className={"font-display font-semibold tabular-nums " + (label.length > 7 ? "text-base" : "text-lg")}>{label}</div>
      </div>
    </div>
  );
}

function tierOf(t: any): { tier: 0 | 1 | 2 | 3; label: string; sortKey: number } {
  const hrs = hoursUntil(t.deadline);
  if (t.deadline && hrs < 0) return { tier: 0, label: "OVERDUE", sortKey: hrs }; // most overdue first
  if (t.risk_level === "critical" || (t.deadline && hrs < 1)) return { tier: 1, label: "CRITICAL", sortKey: hrs };
  if (t.risk_level === "high") return { tier: 2, label: "HIGH", sortKey: hrs };
  return { tier: 3, label: "", sortKey: hrs };
}

function reasonFor(t: any): string {
  const hrs = hoursUntil(t.deadline);
  if (!t.deadline) return "No deadline — risk of indefinite slip.";
  if (hrs < 0) {
    const abs = Math.abs(hrs);
    if (abs < 1) return `Slipped ${Math.round(abs * 60)} min ago — recover now.`;
    if (abs < 24) return `Past deadline by ${Math.round(abs)}h — recovery plan urgent.`;
    return `Past deadline by ${Math.round(abs / 24)}d — needs a triage decision.`;
  }
  if (hrs < 1) return `Due in ${Math.round(hrs * 60)} min — start immediately.`;
  if (hrs < 6) return `Only ${Math.round(hrs)}h left — protect the next block.`;
  return `Due in ${Math.round(hrs)}h — at high risk of being missed.`;
}

export function EmergencyBanner({ task, tasks }: { task?: any; tasks?: any[] }) {
  const source: any[] = tasks ?? (task ? [task] : []);
  // Dedupe by id — alertTasks may merge riskTasks + tasks which overlap.
  const seen = new Set<string>();
  const unique = source.filter((t) => {
    if (!t || seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
  const critical = unique
    .filter((t) => t && t.status !== "done")
    .map((t) => ({ t, ...tierOf(t) }))
    .filter((x) => x.tier <= 2)
    .sort((a, b) => a.tier - b.tier || a.sortKey - b.sortKey);

  if (critical.length === 0) return null;

  const primary = critical[0];
  const secondary = critical.slice(1, 4);
  const overdueCount = critical.filter((c) => c.tier === 0).length;
  const criticalCount = critical.filter((c) => c.tier === 1).length;
  const summaryBits = [
    overdueCount && `${overdueCount} overdue`,
    criticalCount && `${criticalCount} critical`,
    critical.length - overdueCount - criticalCount > 0 && `${critical.length - overdueCount - criticalCount} high-risk`,
  ].filter(Boolean);

  const tierStyle = (tier: number) =>
    tier === 0
      ? "border-destructive text-destructive bg-destructive/20"
      : tier === 1
        ? "border-destructive/70 text-destructive bg-destructive/15"
        : "border-amber-400/60 text-amber-300 bg-amber-500/10";

  return (
    <div className="rounded-xl border border-destructive/50 bg-destructive/10 shadow-card overflow-hidden">
      {/* Compact header with inline primary action */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-destructive/30">
        <div className="size-7 rounded-md bg-destructive/30 grid place-items-center shrink-0 animate-pulse">
          <AlertOctagon className="size-4 text-destructive" />
        </div>
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-[10px] uppercase tracking-widest text-destructive">🚨 Deadline Guardian</div>
          <div className="text-xs text-foreground/90 truncate">
            {critical.length} critical
            {summaryBits.length > 0 && <span className="text-muted-foreground"> · {summaryBits.join(" · ")}</span>}
          </div>
        </div>
      </div>

      {/* Primary task — compact row */}
      <Link
        to="/tasks/$taskId"
        params={{ taskId: primary.t.id }}
        className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-background/40 transition"
      >
        <span className={"text-[9px] font-semibold tracking-widest px-1.5 py-0.5 rounded border shrink-0 " + tierStyle(primary.tier)}>
          {primary.label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{primary.t.title}</div>
          <div className="text-[11px] text-muted-foreground truncate">{reasonFor(primary.t)}</div>
        </div>
        <Button
          size="sm"
          className="bg-gradient-hot text-background shrink-0 h-7 px-2 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <ShieldAlert className="size-3 mr-1" /> Rescue
        </Button>
      </Link>

      {/* Secondary alerts */}
      {secondary.length > 0 && (
        <div className="px-2 pb-2 space-y-0.5 border-t border-destructive/20 pt-1.5">
          {secondary.map(({ t, tier, label }) => (
            <Link
              key={t.id}
              to="/tasks/$taskId"
              params={{ taskId: t.id }}
              className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-white/5 transition"
            >
              <span className={"text-[8px] font-semibold tracking-widest px-1 py-0.5 rounded border shrink-0 " + tierStyle(tier)}>
                {label}
              </span>
              <div className="flex-1 min-w-0 text-xs truncate">{t.title}</div>
              <div className="text-[10px] text-muted-foreground shrink-0">{fmtCountdown(t.deadline)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function PriorityQueue({ tasks }: { tasks: any[] }) {
  const ranked = [...tasks]
    .filter((t) => t.status !== "done")
    .sort((a, b) => (b.urgency_score ?? 0) - (a.urgency_score ?? 0))
    .slice(0, 5);
  if (!ranked.length) return null;
  const maxUrg = Math.max(...ranked.map((t) => t.urgency_score ?? 0), 1);
  const labelFor = (u: number) => {
    if (u >= 15) return { label: "🔥 Extreme", cls: "text-destructive" };
    if (u >= 8) return { label: "High", cls: "text-amber-300" };
    if (u >= 3) return { label: "Medium", cls: "text-sky-300" };
    return { label: "Low", cls: "text-emerald-300" };
  };
  return (
    <GlassCard>
      <SectionTitle kicker="🎯 AI Priority Queue">Do these next</SectionTitle>
      <ol className="space-y-1.5">
        {ranked.map((t, i) => {
          const u = t.urgency_score ?? 0;
          const { label, cls } = labelFor(u);
          const score = Math.min(100, Math.round((u / Math.max(maxUrg, 1)) * 100));
          return (
          <Link
            key={t.id}
            to="/tasks/$taskId"
            params={{ taskId: t.id }}
            className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-md hover:bg-white/5 transition"
          >
            <div className="size-6 grid place-items-center rounded-full bg-white/5 text-xs font-medium text-muted-foreground shrink-0">{i + 1}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{t.title}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span>{fmtCountdown(t.deadline)}</span>
                <span>·</span>
                <span className={cls + " font-medium"}>{label}</span>
                <span className="text-[10px] opacity-70">· {score}/100</span>
              </div>
            </div>
            <RiskBadge level={t.risk_level} />
          </Link>
          );
        })}
      </ol>
    </GlassCard>
  );
}

export function FocusWindow({ metrics, tasks }: { metrics: any[]; tasks: any[] }) {
  // Heuristic: hour with most historical completions, fallback to 9-11am.
  const counts = new Map<number, number>();
  for (const t of tasks) {
    if (t.completed_at) {
      const h = new Date(t.completed_at).getHours();
      counts.set(h, (counts.get(h) ?? 0) + 1);
    }
  }
  let bestHour = 9;
  let bestCount = 0;
  for (const [h, c] of counts) if (c > bestCount) { bestCount = c; bestHour = h; }
  const start = bestHour;
  const end = (bestHour + 2) % 24;
  const fmt = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? "AM" : "PM"}`;
  const avg = metrics.length ? Math.round(metrics.reduce((a: number, m: any) => a + (m.productivity_score ?? 0), 0) / metrics.length) : null;
  // Expected outcomes: which open tasks fit into the 2h block, ranked by urgency.
  const budget = 120;
  const candidates = [...tasks]
    .filter((t) => t.status !== "done" && (t.estimated_minutes ?? 0) > 0)
    .sort((a, b) => (b.urgency_score ?? 0) - (a.urgency_score ?? 0));
  const outcomes: any[] = [];
  let used = 0;
  for (const t of candidates) {
    const need = Math.min(t.estimated_minutes ?? 60, 90);
    if (used + need > budget && outcomes.length > 0) continue;
    outcomes.push({ t, need });
    used += need;
    if (outcomes.length >= 3 || used >= budget) break;
  }
  return (
    <GlassCard>
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-lg bg-amber-500/20 grid place-items-center shrink-0">
          <Sun className="size-4 text-amber-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Today's Focus Window</div>
          <div className="font-display text-2xl mt-0.5">{fmt(start)}{" – "}{fmt(end)}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {bestCount > 0
              ? `Your best 2-hour block historically (${bestCount} tasks completed near ${fmt(start)}).`
              : "Default deep-work window. As you complete tasks, this adapts to your rhythm."}
            {avg !== null && ` · 7-day avg productivity ${avg}%.`}
          </div>
          {outcomes.length > 0 && (
            <div className="mt-3 rounded-lg bg-white/5 p-2.5">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Expected outcomes</div>
              <ul className="text-xs space-y-1">
                {outcomes.map(({ t, need }) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <span className="text-emerald-300">✓</span>
                    <span className="truncate flex-1">{t.title}</span>
                    <span className="text-muted-foreground shrink-0">~{need}m</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

export function ExplainabilityList({ task, subtasks = [] }: { task: any; subtasks?: any[] }) {
  const reasons = explainCritical(task, subtasks);
  const conf = Math.round((task.estimated_completion_probability ?? 0) * 100);
  const color = confidenceColor(task.estimated_completion_probability ?? 0);
  const proc = Math.round((task.procrastination_risk ?? 0) * 100);
  const isOverdue = task.deadline ? new Date(task.deadline).getTime() < Date.now() && task.status !== "done" : false;
  const factors: { sign: "+" | "-"; label: string; delta: number }[] = [];
  if (task.priority >= 4) factors.push({ sign: "+", label: "High priority signal", delta: 15 });
  if (proc >= 50) factors.push({ sign: "-", label: "High procrastination risk", delta: -20 });
  const hrs = hoursUntil(task.deadline);
  if (hrs < 12) factors.push({ sign: "-", label: "Limited remaining time", delta: -25 });
  else if (hrs > 48) factors.push({ sign: "+", label: "Time-rich buffer", delta: 10 });
  if (task.category === "exam") factors.push({ sign: "-", label: "Exam category historically harder", delta: -10 });
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Why this risk level?</div>
        <ul className="text-xs text-muted-foreground space-y-0.5">
          {reasons.map((r) => <li key={r}>• {r}</li>)}
          {task.procrastination_reason && <li>• {task.procrastination_reason}</li>}
        </ul>
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
          {isOverdue ? "Past deadline" : `AI confidence factors (${conf}%)`}
        </div>
        {isOverdue ? (
          <p className="text-xs text-muted-foreground">Completion prediction no longer applies — focus on rescue or mark the outcome.</p>
        ) : (
          <ul className="text-xs space-y-0.5">
            {factors.length === 0 && <li className="text-muted-foreground">Balanced — no dominant factor.</li>}
            {factors.map((f) => (
              <li key={f.label} className={f.sign === "+" ? "text-emerald-400" : "text-amber-300"}>
                {f.sign} {f.label} ({f.sign}{Math.abs(f.delta)}%)
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Overdue badge — used in task lists and dashboard rows.
// ============================================================
export function OverdueBadge({ deadline, confidence }: { deadline: string | null; confidence?: number }) {
  const hrs = hoursUntil(deadline);
  if (!deadline || hrs >= 0) return null;
  const abs = Math.abs(hrs);
  const label = abs < 1 ? `${Math.round(abs * 60)}m` : abs < 24 ? `${Math.round(abs)}h` : `${Math.round(abs / 24)}d`;
  const conf = typeof confidence === "number" ? Math.round(confidence * 100) : null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md border border-destructive/70 bg-destructive/20 text-destructive animate-pulse">
      🔴 Overdue {label}
      {conf !== null && <span className="font-normal opacity-80">· {conf}%</span>}
    </span>
  );
}

// ============================================================
// AI Wellness Monitor — energy / focus / burnout signals.
// ============================================================
export function WellnessMonitor({
  productivity,
  missedLast48h,
  metrics,
  tasks,
}: {
  productivity: number;
  missedLast48h: number;
  metrics: any[];
  tasks: any[];
}) {
  const overdueCount = tasks.filter(
    (t) => t.status !== "done" && t.deadline && new Date(t.deadline).getTime() < Date.now(),
  ).length;
  const recent = metrics.slice(-3);
  const recentAvg = recent.length ? recent.reduce((a, m) => a + (m.productivity_score ?? 0), 0) / recent.length : productivity;
  const completedToday = metrics.find((m) => m.date === new Date().toISOString().slice(0, 10))?.completed ?? 0;

  const tier = (v: number, lo: number, hi: number) =>
    v < lo ? "Low" : v > hi ? "High" : "Medium";

  const energy = tier(recentAvg, 45, 75);
  const focus = completedToday >= 3 ? "High" : completedToday >= 1 ? "Medium" : recentAvg < 40 ? "Low" : "Medium";
  const burnoutScore = missedLast48h * 20 + overdueCount * 15 + Math.max(0, 60 - productivity);
  const burnout = burnoutScore > 80 ? "High" : burnoutScore > 40 ? "Medium" : "Low";

  const recs: string[] = [];
  if (burnout === "High") recs.push("Cut workload by 30–40% today — postpone non-critical work.");
  else if (burnout === "Medium") recs.push("Protect one 90-min deep-work block and skip a low-value task.");
  if (overdueCount > 0) recs.push(`Triage ${overdueCount} overdue task${overdueCount > 1 ? "s" : ""} first — decide rescue or drop.`);
  if (energy === "Low") recs.push("Front-load the easiest task to build momentum, then tackle the hardest.");
  if (focus === "Low" && energy !== "Low") recs.push("You have energy but no completions yet — start a 25-min timer now.");
  if (recs.length === 0) recs.push("You're in a healthy rhythm. Keep your current cadence.");

  const pill = (v: string) =>
    v === "High"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : v === "Medium"
        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
        : "bg-destructive/15 text-destructive border-destructive/30";
  const pillBurnout = (v: string) =>
    v === "Low"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : v === "Medium"
        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
        : "bg-destructive/15 text-destructive border-destructive/30";

  return (
    <GlassCard className={burnout === "High" ? "border-destructive/40" : burnout === "Medium" ? "border-amber-500/30" : ""}>
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-lg bg-pink-500/20 grid place-items-center shrink-0">
          <Heart className="size-4 text-pink-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">AI Wellness Monitor</div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className={"rounded-md border px-2 py-1.5 text-center " + pill(energy)}>
              <div className="text-[9px] uppercase tracking-widest opacity-80 flex items-center justify-center gap-1"><Zap className="size-2.5" /> Energy</div>
              <div className="text-sm font-semibold">{energy}</div>
            </div>
            <div className={"rounded-md border px-2 py-1.5 text-center " + pill(focus)}>
              <div className="text-[9px] uppercase tracking-widest opacity-80 flex items-center justify-center gap-1"><Brain className="size-2.5" /> Focus</div>
              <div className="text-sm font-semibold">{focus}</div>
            </div>
            <div className={"rounded-md border px-2 py-1.5 text-center " + pillBurnout(burnout)}>
              <div className="text-[9px] uppercase tracking-widest opacity-80 flex items-center justify-center gap-1"><Activity className="size-2.5" /> Burnout</div>
              <div className="text-sm font-semibold">{burnout}</div>
            </div>
          </div>
          <ul className="mt-3 text-xs text-muted-foreground space-y-1">
            {recs.slice(0, 3).map((r) => <li key={r}>• {r}</li>)}
          </ul>
        </div>
      </div>
    </GlassCard>
  );
}

// ============================================================
// Simulate Delay — predictive what-if for critical tasks.
// ============================================================
export function SimulateDelay({ task, subtasks = [] }: { task: any; subtasks?: any[] }) {
  const [hours, setHours] = useState(4);
  const baseP = task.estimated_completion_probability ?? completionProbability(task, subtasks);
  const baseHrs = hoursUntil(task.deadline);
  const shifted = { ...task, deadline: task.deadline ? new Date(new Date(task.deadline).getTime() - hours * 3600_000).toISOString() : null };
  // Approximate "shifted" probability by feeding a tighter virtual deadline.
  const newP = completionProbability(shifted, subtasks);
  const pctDelta = Math.round((newP - baseP) * 100);
  const tomorrowLoad = Math.round((task.estimated_minutes ?? 60) * Math.min(1, hours / Math.max(1, baseHrs)) / 60 * 10) / 10;
  const burnoutBefore = baseP < 0.4 ? "Medium" : "Low";
  const burnoutAfter = newP < 0.3 ? "High" : newP < 0.5 ? "Medium" : "Low";
  const latestStartMins = Math.max(0, Math.round((baseHrs - (task.estimated_minutes ?? 60) / 60) * 60));
  const latestStartLabel = latestStartMins < 60 ? `${latestStartMins} min` : `${Math.round(latestStartMins / 60)}h`;
  if (baseHrs < 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10">
          <Zap className="size-3 mr-1" /> Simulate Delay
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Predictive what-if</div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs">Delay by</span>
          <input
            type="range" min={1} max={12} value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="flex-1 accent-amber-400"
          />
          <span className="text-xs font-medium w-10 text-right">{hours}h</span>
        </div>
        <ul className="text-xs space-y-1.5">
          <li className="flex justify-between"><span className="text-muted-foreground">Success probability</span>
            <span><span className="text-foreground">{Math.round(baseP * 100)}%</span> <span className="text-muted-foreground">→</span> <span className={pctDelta < 0 ? "text-destructive font-semibold" : "text-emerald-300 font-semibold"}>{Math.round(newP * 100)}%</span></span>
          </li>
          <li className="flex justify-between"><span className="text-muted-foreground">Tomorrow workload</span><span className="text-amber-300">+{tomorrowLoad}h</span></li>
          <li className="flex justify-between"><span className="text-muted-foreground">Burnout risk</span>
            <span>{burnoutBefore} <span className="text-muted-foreground">→</span> <span className={burnoutAfter === "High" ? "text-destructive font-semibold" : burnoutAfter === "Medium" ? "text-amber-300 font-semibold" : "text-emerald-300 font-semibold"}>{burnoutAfter}</span></span>
          </li>
        </ul>
        <div className="mt-3 pt-3 border-t border-border/40 text-xs">
          <div className="text-muted-foreground">Recommendation</div>
          <div className="mt-0.5">Start within the next <span className="font-semibold text-amber-300">{latestStartLabel}</span> to keep success above {Math.round(baseP * 100)}%.</div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// Activity feed dedup — group identical (agent+action+task) events within 30 min.
// ============================================================
export function dedupActivity(activity: any[]): any[] {
  if (!activity?.length) return [];
  const WINDOW = 30 * 60_000;
  const out: any[] = [];
  for (const a of activity) {
    const ts = new Date(a.created_at).getTime();
    const key = `${a.agent}|${a.action}|${a.task_id ?? ""}`;
    const existing = out.find(
      (b) => `${b.agent}|${b.action}|${b.task_id ?? ""}` === key &&
        Math.abs(new Date(b.created_at).getTime() - ts) <= WINDOW,
    );
    if (existing) {
      existing._count = (existing._count ?? 1) + 1;
      // Keep the newest timestamp at the top of the group.
      if (ts > new Date(existing.created_at).getTime()) existing.created_at = a.created_at;
    } else {
      out.push({ ...a, _count: 1 });
    }
  }
  return out;
}