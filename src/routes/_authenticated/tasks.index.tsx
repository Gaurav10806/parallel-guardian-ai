import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Wand2, Plus, Trash2 } from "lucide-react";
import { captureTask, createTask, deleteTask, listTasks, planTask, generateRescuePlan, updateTaskStatus } from "@/lib/agents.functions";
import { GlassCard, SectionTitle, EmptyState, RiskBadge, fmtCountdown } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { explainCritical, confidenceColor } from "@/lib/risk";
import { ExplainabilityList, fireConfetti, OverdueBadge, SimulateDelay } from "@/components/ai-features";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks/")({
  head: () => ({ meta: [{ title: "Tasks — Parallel Guardian AI" }] }),
  component: TasksPage,
});

function TasksPage() {
  const qc = useQueryClient();
  const { data: tasks = [], isLoading } = useQuery({ queryKey: ["tasks"], queryFn: () => listTasks() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight">Tasks</h1>
        <p className="text-sm text-muted-foreground">Capture in plain English, plan with AI, rescue when it slips.</p>
      </div>

      <Composer onCreated={invalidate} />

      <GlassCard>
        <SectionTitle>All tasks</SectionTitle>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : tasks.length === 0 ? (
          <EmptyState title="No tasks yet" body="Use Smart Capture to describe one in plain English." icon={Wand2} />
        ) : (
          <div className="space-y-2">
            {tasks.map((t: any) => <TaskRow key={t.id} task={t} onChanged={invalidate} />)}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function Composer({ onCreated }: { onCreated: () => void }) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [estimated, setEstimated] = useState(60);
  const [priority, setPriority] = useState(3);

  const capture = useMutation({
    mutationFn: () => captureTask({ data: { text } }),
    onSuccess: (t: any) => { toast.success(`Captured "${t.title}"`); setText(""); onCreated(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const manual = useMutation({
    mutationFn: () => createTask({ data: { title, deadline: deadline ? new Date(deadline).toISOString() : null, estimated_minutes: estimated, priority } }),
    onSuccess: () => { toast.success("Task created"); setTitle(""); setDeadline(""); onCreated(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <GlassCard>
      <SectionTitle kicker="New task">Smart Capture</SectionTitle>
      <Tabs defaultValue="describe">
        <TabsList>
          <TabsTrigger value="describe"><Wand2 className="size-3.5 mr-1.5" /> Describe it</TabsTrigger>
          <TabsTrigger value="manual"><Plus className="size-3.5 mr-1.5" /> Manual</TabsTrigger>
        </TabsList>
        <TabsContent value="describe" className="space-y-3 mt-3">
          <Textarea
            placeholder='e.g. "I have a DBMS viva on Friday and need 6 hours of preparation."'
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button className="bg-gradient-hot text-background" disabled={!text || capture.isPending} onClick={() => capture.mutate()}>
              {capture.isPending ? "Thinking…" : "Capture with AI"}
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="manual" className="space-y-3 mt-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Deadline</Label><Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Estimated minutes</Label><Input type="number" min={5} value={estimated} onChange={(e) => setEstimated(Number(e.target.value))} /></div>
            <div className="space-y-1"><Label className="text-xs">Priority (1-5)</Label><Input type="number" min={1} max={5} value={priority} onChange={(e) => setPriority(Number(e.target.value))} /></div>
          </div>
          <div className="flex justify-end">
            <Button disabled={!title || manual.isPending} onClick={() => manual.mutate()}>
              {manual.isPending ? "Saving…" : "Create"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </GlassCard>
  );
}

function TaskRow({ task, onChanged }: { task: any; onChanged: () => void }) {
  const plan = useMutation({
    mutationFn: () => planTask({ data: { taskId: task.id } }),
    onSuccess: () => { toast.success("Plan generated"); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const rescue = useMutation({
    mutationFn: () => generateRescuePlan({ data: { taskId: task.id } }),
    onSuccess: () => { toast.success("Rescue plan ready"); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const del = useMutation({
    mutationFn: () => deleteTask({ data: { id: task.id } }),
    onSuccess: () => { toast.success("Deleted"); onChanged(); },
  });
  const done = useMutation({
    mutationFn: () => updateTaskStatus({ data: { id: task.id, status: task.status === "done" ? "pending" : "done" } }),
    onSuccess: () => { if (task.status !== "done") fireConfetti(); onChanged(); },
  });
  const miss = useMutation({
    mutationFn: () => updateTaskStatus({ data: { id: task.id, status: "missed" } }),
    onSuccess: () => { toast.success("Marked as missed"); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const proc = Math.round((task.procrastination_risk ?? 0) * 100);
  const conf = Math.round((task.estimated_completion_probability ?? 0) * 100);
  const color = confidenceColor(task.estimated_completion_probability ?? 0);
  const isOverdue = task.deadline ? new Date(task.deadline).getTime() < Date.now() && task.status !== "done" : false;
  const isMissed = task.status === "missed";

  return (
    <Link
      to="/tasks/$taskId"
      params={{ taskId: task.id }}
      className={"rounded-xl border p-3 flex flex-col sm:flex-row gap-3 sm:items-center hover:bg-white/5 transition cursor-pointer " + (isMissed ? "border-destructive/40 bg-destructive/5" : isOverdue ? "border-destructive/60 bg-destructive/10" : "border-border/60")}
    >
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {isOverdue ? <OverdueBadge deadline={task.deadline} confidence={task.estimated_completion_probability} /> : <RiskBadge level={task.risk_level} />}
          {isMissed && <span className="text-[10px] px-2 py-0.5 rounded-md bg-destructive/20 text-destructive border border-destructive/40 font-semibold uppercase tracking-wider">Missed</span>}
          {task.ai_generated && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent">AI</span>}
          <span className={"font-medium truncate " + (isMissed ? "line-through text-muted-foreground" : "")}>{task.title}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
          <span>{fmtCountdown(task.deadline)}</span>
          <span>· {task.estimated_minutes}m</span>
          <span>· {task.category}</span>
          {isOverdue ? (
            <span className="text-destructive">· past deadline</span>
          ) : (
            <span className={
              color === "green" ? "text-emerald-400" : color === "yellow" ? "text-amber-300" : "text-destructive"
            }>· {conf}% confidence</span>
          )}
          {proc >= 50 && <span className="text-amber-300">· 🧠 {proc}% procrastination</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <Popover>
          <PopoverTrigger asChild><Button variant="ghost" size="sm" className="text-xs">Why?</Button></PopoverTrigger>
          <PopoverContent className="w-72 text-sm">
            <ExplainabilityList task={task} />
          </PopoverContent>
        </Popover>
        {(task.risk_level === "critical" || task.risk_level === "high") && !isOverdue && (
          <SimulateDelay task={task} />
        )}
        <Button size="sm" variant="outline" disabled={plan.isPending} onClick={() => plan.mutate()}>{plan.isPending ? "…" : "Plan with AI"}</Button>
        {(task.risk_level === "high" || task.risk_level === "critical") && (
          <Button size="sm" className="bg-gradient-hot text-background" disabled={rescue.isPending} onClick={() => rescue.mutate()}>
            {rescue.isPending ? "…" : "Rescue"}
          </Button>
        )}
        <Button size="sm" variant={task.status === "done" ? "secondary" : "default"} onClick={() => done.mutate()}>
          {task.status === "done" ? "Undo" : "Done"}
        </Button>
        {task.status !== "done" && task.status !== "missed" && (
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => miss.mutate()}>Miss</Button>
        )}
        <Button size="icon" variant="ghost" onClick={() => del.mutate()}><Trash2 className="size-4" /></Button>
      </div>
    </Link>
  );
}