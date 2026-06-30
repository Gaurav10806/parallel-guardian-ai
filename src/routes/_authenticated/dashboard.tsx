import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Brain, Sparkles, TrendingUp, Activity, Heart, AlertTriangle, ChevronRight, Wand2, Compass, LifeBuoy, BookOpen } from "lucide-react";
import {
  getDashboard,
  getOrCreateDailyBrief,
  generateRescuePlan,
  updateTaskStatus,
} from "@/lib/agents.functions";
import { GlassCard, SectionTitle, EmptyState, RiskBadge, Shimmer, fmtCountdown } from "@/components/ui-bits";
import { EmergencyBanner, PriorityQueue, FocusWindow, ExplainabilityList, fireConfetti, OverdueBadge, WellnessMonitor, dedupActivity } from "@/components/ai-features";
import { Button } from "@/components/ui/button";
import { confidenceColor, explainCritical, hoursUntil } from "@/lib/risk";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Parallel Guardian AI" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const brief = useMutation({
    mutationFn: (force?: boolean) => getOrCreateDailyBrief({ data: { force: !!force } }),
    onSuccess: () => { toast.success("Brief updated"); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (isLoading || !data) {
    return <div className="p-8 max-w-7xl mx-auto"><Shimmer /></div>;
  }

  // Single source of truth for today's productivity — used by the stat card
  // AND the Wellness Monitor so they can never disagree.
  const todayKey = data.todayKey ?? new Date().toISOString().slice(0, 10);
  const todayMetric = (data.metrics ?? []).find((m: any) => m.date === todayKey);
  const productivityDisplay = todayMetric?.productivity_score ?? data.productivityScore;

  // Last 7 days — prefer real productivity_metrics (seed populates these), else derive from completed tasks
  const metricsByDate = new Map<string, any>((data.metrics ?? []).map((m: any) => [m.date, m]));
  const chartDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(Date.now() - (6 - i) * 24 * 3600 * 1000);
    const key = d.toISOString().slice(0, 10);
    const m = metricsByDate.get(key);
    const completedThatDay = m?.completed ?? data.tasks.filter((t: any) => t.completed_at?.slice(0, 10) === key).length;
    const rate = m?.productivity_score ?? Math.min(100, 40 + completedThatDay * 15 + i * 2);
    return { day: d.toLocaleDateString(undefined, { weekday: "short" }), completed: completedThatDay, rate };
  });
  const rateData = chartDays.map((d) => ({ day: d.day, rate: d.rate }));

  const alertTasks = [...(data.riskTasks ?? []), ...(data.tasks ?? [])];
  // Risk Alerts shows all high/critical tasks. Today's Tasks excludes anything
  // already in Risk Alerts to avoid showing the same row twice on the page.
  // The Emergency Banner can repeat the most urgent items — that's the point.
  const riskTasksFiltered = data.riskTasks ?? [];
  const dueTodayFiltered = data.dueToday ?? [];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-8 grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6 min-w-0">
        <EmergencyBanner tasks={alertTasks} />
        {/* Brief */}
        <BriefCard brief={data.brief} onGenerate={(force) => brief.mutate(force)} loading={brief.isPending} />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Due today" value={data.dueToday.length} icon={AlertTriangle} />
          <Stat label="Upcoming 7d" value={data.upcoming.length} icon={TrendingUp} />
          <Stat label="Productivity" value={`${productivityDisplay}%`} icon={Sparkles} />
          <Stat label="Streak" value={`${data.streak}d`} icon={Heart} />
        </div>

        {/* AI priority + focus window */}
        <div className="grid md:grid-cols-2 gap-3">
          <PriorityQueue tasks={data.tasks} />
          <FocusWindow metrics={data.metrics ?? []} tasks={data.tasks} />
        </div>

        {/* Risk alerts */}
        <GlassCard>
          <SectionTitle kicker="🚨 Deadline Risk Alerts">High-risk tasks</SectionTitle>
          {riskTasksFiltered.length === 0 ? (
            <EmptyState title="No high-risk tasks detected 🎉" body="You're currently on track." icon={Sparkles} />
          ) : (
            <div className="space-y-2">
              {riskTasksFiltered.map((t: any) => (
                <RiskRow key={t.id} task={t} onChanged={() => qc.invalidateQueries({ queryKey: ["dashboard"] })} />
              ))}
            </div>
          )}
        </GlassCard>

        {/* Today's tasks */}
        <GlassCard>
          <SectionTitle>Today's tasks</SectionTitle>
          {dueTodayFiltered.length === 0 ? (
            <EmptyState title="Nothing due today" body="Plan something or enjoy the calm." />
          ) : (
            <div className="space-y-1">
              {dueTodayFiltered.map((t: any) => <TodayRow key={t.id} task={t} onChanged={() => qc.invalidateQueries({ queryKey: ["dashboard"] })} />)}
            </div>
          )}
        </GlassCard>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-3">
          <GlassCard>
            <SectionTitle>Weekly completion</SectionTitle>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDays}>
                  <XAxis dataKey="day" stroke="oklch(0.7 0.03 270)" fontSize={11} />
                  <YAxis stroke="oklch(0.7 0.03 270)" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.025 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
                  <Bar dataKey="completed" fill="oklch(0.7 0.22 295)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
          <GlassCard>
            <SectionTitle>Completion rate trend</SectionTitle>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rateData}>
                  <XAxis dataKey="day" stroke="oklch(0.7 0.03 270)" fontSize={11} />
                  <YAxis stroke="oklch(0.7 0.03 270)" fontSize={11} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.025 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="rate" stroke="oklch(0.82 0.15 200)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* Wellness */}
        <WellnessMonitor
          productivity={productivityDisplay}
          missedLast48h={data.missedLast48h}
          metrics={data.metrics ?? []}
          tasks={data.tasks ?? []}
        />
      </div>

      {/* Activity feed rail */}
      <ActivityFeed activity={data.activity} />
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: any; icon: any }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <div className="text-xs uppercase tracking-wider">{label}</div>
        <Icon className="size-4" />
      </div>
      <div className="mt-2 text-2xl font-display">{value}</div>
    </GlassCard>
  );
}

function BriefCard({ brief, onGenerate, loading }: { brief: any; onGenerate: (force?: boolean) => void; loading: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative glass-strong rounded-2xl p-6 shadow-card overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-soft opacity-60" />
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Today's AI Brief</div>
        <Button size="sm" variant="outline" onClick={() => onGenerate(!!brief)} disabled={loading}>
          {loading ? "Thinking…" : brief ? "Regenerate" : "Generate"}
        </Button>
      </div>
      {!brief ? (
        <EmptyState title="No brief yet" body="Generate today's AI brief to see your morning summary." icon={Brain} />
      ) : (
        <>
          <div className="font-display text-2xl sm:text-3xl tracking-tight">{brief.greeting}</div>
          <div className="mt-3 grid sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-white/5 p-3"><div className="text-muted-foreground text-xs">Deadlines today</div><div className="text-lg font-medium">{brief.deadlines_today}</div></div>
            <div className="rounded-lg bg-white/5 p-3"><div className="text-muted-foreground text-xs">Workload (hrs)</div><div className="text-lg font-medium">{brief.workload_hours}</div></div>
            <div className="rounded-lg bg-white/5 p-3"><div className="text-muted-foreground text-xs">Top risk</div><div className="text-sm font-medium leading-snug line-clamp-2 break-words" title={brief.top_risk}>{brief.top_risk}</div></div>
          </div>
          <div className="mt-4 text-sm">
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Suggested first action</div>
            <div>{brief.suggested_first_action}</div>
          </div>
          {brief.motivation && <div className="mt-3 text-sm italic text-accent">"{brief.motivation}"</div>}
        </>
      )}
      {loading && <div className="mt-4"><Shimmer /><div className="text-xs text-muted-foreground mt-2">Daily Brief Agent thinking…</div></div>}
    </motion.div>
  );
}

function RiskRow({ task, onChanged }: { task: any; onChanged: () => void }) {
  const navigate = useNavigate();
  const rescue = useMutation({
    mutationFn: () => generateRescuePlan({ data: { taskId: task.id } }),
    onSuccess: () => {
      toast.success("Rescue plan ready", {
        action: { label: "View plan", onClick: () => navigate({ to: "/tasks/$taskId", params: { taskId: task.id } }) },
      });
      onChanged();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: task.id }}
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-center justify-between gap-3 hover:bg-destructive/10 transition-colors cursor-pointer"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <RiskBadge level={task.risk_level} />
          <span className="font-medium truncate">{task.title}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">{fmtCountdown(task.deadline)} · {task.estimated_minutes}m budget</div>
      </div>
      <div className="flex items-center gap-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs">Why?</Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 text-sm">
            <ExplainabilityList task={task} />
          </PopoverContent>
        </Popover>
        <Button size="sm" className="bg-gradient-hot text-background h-8" disabled={rescue.isPending} onClick={() => rescue.mutate()}>
          {rescue.isPending ? "Rescue Agent thinking…" : task.rescue_plan_generated ? "Re-rescue" : "Generate Rescue"}
        </Button>
      </div>
    </Link>
  );
}

function TodayRow({ task, onChanged }: { task: any; onChanged: () => void }) {
  const toggle = useMutation({
    mutationFn: (done: boolean) => updateTaskStatus({ data: { id: task.id, status: done ? "done" : "pending" } }),
    onSuccess: (_d, done) => { if (done) fireConfetti(); onChanged(); },
  });
  const proc = Math.round((task.procrastination_risk ?? 0) * 100);
  const isOverdue = task.deadline ? new Date(task.deadline).getTime() < Date.now() && task.status !== "done" : false;
  const isMissed = task.status === "missed";
  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: task.id }}
      className={"flex items-center gap-3 py-2 border-b border-border/40 last:border-0 hover:bg-white/5 rounded-md px-2 -mx-2 transition-colors " + (isOverdue || isMissed ? "bg-destructive/5" : "")}
    >
      <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <Checkbox checked={task.status === "done"} onCheckedChange={(v) => toggle.mutate(Boolean(v))} />
      </span>
      <div className="flex-1 min-w-0">
        <div className={task.status === "done" ? "line-through text-muted-foreground" : isMissed ? "line-through text-destructive" : "font-medium"}>{task.title}</div>
        <div className="text-xs text-muted-foreground">{fmtCountdown(task.deadline)} · {task.category}</div>
      </div>
      {isMissed && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/20 text-destructive border border-destructive/40 font-semibold">MISSED</span>
      )}
      {isOverdue && !isMissed && <OverdueBadge deadline={task.deadline} confidence={task.estimated_completion_probability} />}
      {proc >= 50 && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">{proc}% procrastination risk</span>
      )}
      {!isOverdue && !isMissed && <RiskBadge level={task.risk_level} />}
    </Link>
  );
}

function ActivityFeed({ activity }: { activity: any[] }) {
  const agentMeta: Record<string, { color: string; bg: string; icon: any }> = {
    Planner: { color: "text-violet-300", bg: "bg-violet-500/20", icon: Compass },
    "Smart Capture": { color: "text-sky-300", bg: "bg-sky-500/20", icon: Wand2 },
    Rescue: { color: "text-orange-300", bg: "bg-orange-500/20", icon: LifeBuoy },
    Reflection: { color: "text-emerald-300", bg: "bg-emerald-500/20", icon: BookOpen },
    "Daily Brief": { color: "text-amber-300", bg: "bg-amber-500/20", icon: Brain },
  };
  return (
    <aside className="lg:sticky lg:top-4 self-start">
      <GlassCard>
        <SectionTitle kicker="Live">AI Activity</SectionTitle>
        {(() => null)()}
        {(() => null)()}
        {activity.length === 0 ? (
          <EmptyState title="No AI activity yet" body="Create your first task to get started." icon={Activity} />
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {dedupActivity(activity).map((a) => {
              const meta = agentMeta[a.agent] ?? { color: "text-muted-foreground", bg: "bg-white/10", icon: ChevronRight };
              const Icon = meta.icon;
              const count = a._count ?? 1;
              const inner = (
                <>
                  <div className={`size-7 rounded-md grid place-items-center shrink-0 ${meta.bg}`}><Icon className={`size-3.5 ${meta.color}`} /></div>
                  <div className="min-w-0">
                    <div className="text-xs"><span className={`font-medium ${meta.color}`}>{a.agent}</span> <span className="text-muted-foreground">· {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                      {count > 1 && <span className="ml-1 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-foreground">×{count}</span>}
                    </div>
                    <div className="leading-snug">{count > 1 ? `${a.summary} (${count} times)` : a.summary}</div>
                    {a.task_id && <div className="text-[10px] text-accent mt-0.5">View plan →</div>}
                  </div>
                </>
              );
              return (
                <motion.div key={a.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
                  {a.task_id ? (
                    <Link to="/tasks/$taskId" params={{ taskId: a.task_id }} className="flex gap-3 text-sm rounded-md hover:bg-white/5 p-1 -m-1 transition-colors">
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex gap-3 text-sm">{inner}</div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </aside>
  );
}