import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Wand2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { getTask, planTask, generateRescuePlan, toggleSubtask, updateTaskStatus } from "@/lib/agents.functions";
import { GlassCard, SectionTitle, EmptyState, RiskBadge, fmtCountdown } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { confidenceColor, explainCritical } from "@/lib/risk";
import { CountdownRing, ExplainabilityList, fireConfetti, OverdueBadge, SimulateDelay } from "@/components/ai-features";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks/$taskId")({
  head: () => ({ meta: [{ title: "Task — Parallel Guardian AI" }] }),
  component: TaskDetail,
});

function TaskDetail() {
  const { taskId } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask({ data: { id: taskId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["task", taskId] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const plan = useMutation({
    mutationFn: () => planTask({ data: { taskId } }),
    onSuccess: () => { toast.success("Plan generated"); invalidate(); },
  });
  const rescue = useMutation({
    mutationFn: () => generateRescuePlan({ data: { taskId } }),
    onSuccess: () => { toast.success("Rescue plan ready"); invalidate(); },
  });
  const done = useMutation({
    mutationFn: (status: "done" | "missed") => updateTaskStatus({ data: { id: taskId, status } }),
    onSuccess: (_d, status) => {
      if (status === "done") { fireConfetti(); toast.success("Marked done"); }
      else toast.success("Marked as missed");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const toggle = useMutation({
    mutationFn: ({ id, d }: { id: string; d: boolean }) => toggleSubtask({ data: { id, done: d } }),
    onSuccess: () => invalidate(),
  });

  if (isLoading || !data?.task) return <div className="p-8">Loading…</div>;
  const { task, subtasks, insights } = data;

  const conf = Math.round(task.estimated_completion_probability * 100);
  const color = confidenceColor(task.estimated_completion_probability);
  const isOverdue = task.deadline ? new Date(task.deadline).getTime() < Date.now() : false;
  const isDone = task.status === "done";
  const rescueInsight = insights.find((i: any) => i.kind === "rescue");
  const planInsight = insights.find((i: any) => i.kind === "plan");

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
      <Link to="/tasks" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="size-3.5" /> Back to tasks</Link>

      {/* AI Success Prediction */}
      <GlassCard className={
        isOverdue && !isDone ? "border-destructive/40" :
        color === "green" ? "border-emerald-500/30" : color === "yellow" ? "border-amber-500/30" : "border-destructive/30"
      }>
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">AI Success Prediction</div>
            {isOverdue && !isDone ? (
              <>
                <div className="text-4xl font-display font-semibold mt-1 text-destructive">Past Deadline</div>
                <div className="text-sm text-muted-foreground mt-1">Prediction no longer applies — run a rescue plan or mark the outcome.</div>
              </>
            ) : (
              <>
                <div className={
                  "text-5xl font-display font-semibold mt-1 " +
                  (color === "green" ? "text-emerald-400" : color === "yellow" ? "text-amber-300" : "text-destructive")
                }>{conf}%</div>
                <div className="text-sm text-muted-foreground mt-1">chance of completing before deadline</div>
              </>
            )}
          </div>
          <CountdownRing deadline={task.deadline} />
        </div>
        <div className="mt-4 pt-4 border-t border-border/40">
          <ExplainabilityList task={task} subtasks={subtasks} />
        </div>
      </GlassCard>

      {/* Header */}
      <GlassCard>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {isOverdue && !isDone
            ? <OverdueBadge deadline={task.deadline} confidence={task.estimated_completion_probability} />
            : <RiskBadge level={task.risk_level} />}
          {task.status === "missed" && <span className="text-[10px] px-2 py-0.5 rounded-md bg-destructive/20 text-destructive border border-destructive/40 font-semibold uppercase tracking-wider">Missed</span>}
          {task.ai_generated && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent">AI captured</span>}
          <span className="text-xs text-muted-foreground">{fmtCountdown(task.deadline)}</span>
        </div>
        <h1 className={"text-2xl font-display font-semibold " + (task.status === "missed" ? "line-through text-muted-foreground" : "")}>{task.title}</h1>
        {task.description && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{task.description}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={plan.isPending} onClick={() => plan.mutate()}><Wand2 className="size-4 mr-1.5" /> {plan.isPending ? "Planning…" : "Plan with AI"}</Button>
          {(task.risk_level === "high" || task.risk_level === "critical") && (
            <Button size="sm" className="bg-gradient-hot text-background" disabled={rescue.isPending} onClick={() => rescue.mutate()}>
              <ShieldAlert className="size-4 mr-1.5" /> {rescue.isPending ? "…" : task.rescue_plan_generated ? "Regenerate Rescue Plan" : "Generate Rescue Plan"}
            </Button>
          )}
          {(task.risk_level === "high" || task.risk_level === "critical") && !isOverdue && (
            <SimulateDelay task={task} subtasks={subtasks} />
          )}
          <Button size="sm" onClick={() => done.mutate("done")} disabled={task.status === "done"}><CheckCircle2 className="size-4 mr-1.5" /> Mark done</Button>
          <Button
            size="sm"
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
            disabled={task.status === "done" || task.status === "missed" || done.isPending}
            onClick={() => done.mutate("missed")}
          >
            {done.isPending ? "…" : "Mark missed"}
          </Button>
        </div>
      </GlassCard>

      {/* Subtasks */}
      <GlassCard>
        <SectionTitle>Subtasks</SectionTitle>
        {subtasks.length === 0 ? (
          <EmptyState title="No subtasks yet" body="Click Plan with AI to break this down." icon={Wand2} action={<Button size="sm" variant="outline" onClick={() => plan.mutate()}>Plan with AI</Button>} />
        ) : (
          <div className="space-y-1">
            {subtasks.map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
                <Checkbox checked={s.status === "done"} onCheckedChange={(v) => toggle.mutate({ id: s.id, d: Boolean(v) })} />
                <div className="flex-1 min-w-0">
                  <div className={s.status === "done" ? "line-through text-muted-foreground" : ""}>{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.estimated_minutes}m</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {planInsight && (
          <div className="mt-4 rounded-lg bg-white/5 p-3 text-sm">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Planner strategy</div>
            <div className="text-muted-foreground">{(planInsight.content as any).strategy}</div>
          </div>
        )}
      </GlassCard>

      {/* Rescue plan */}
      {rescueInsight && (
        <GlassCard className="border-destructive/30">
          <SectionTitle kicker="🚨 Rescue Plan">{(rescueInsight.content as any).headline}</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-3">
              <div className="text-xs font-medium text-emerald-400 mb-1">KEEP</div>
              <ul className="text-sm space-y-1">{((rescueInsight.content as any).keep ?? []).map((k: string) => <li key={k}>• {k}</li>)}</ul>
            </div>
            <div className="rounded-lg bg-destructive/10 p-3">
              <div className="text-xs font-medium text-destructive mb-1">SKIP</div>
              <ul className="text-sm space-y-1">{((rescueInsight.content as any).skip ?? []).map((k: string) => <li key={k}>• {k}</li>)}</ul>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Hour-by-hour schedule</div>
            <div className="space-y-1.5">
              {((rescueInsight.content as any).schedule ?? []).map((s: any, i: number) => (
                <div key={i} className="flex gap-3 text-sm">
                  <div className="text-accent font-medium w-24 shrink-0">{s.time}</div>
                  <div className="flex-1">{s.action}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 text-sm"><span className="text-muted-foreground">Final review: </span><span className="font-medium">{(rescueInsight.content as any).final_review}</span></div>
          {(rescueInsight.content as any).pep && <div className="mt-2 italic text-accent">"{(rescueInsight.content as any).pep}"</div>}
        </GlassCard>
      )}
    </div>
  );
}