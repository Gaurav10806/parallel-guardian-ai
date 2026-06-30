import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import {
  completionProbability,
  procrastinationRisk,
  riskLevel,
  urgencyScore,
} from "./risk";

const MODEL = "google/gemini-3-flash-preview";

function getModel() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  return createLovableAiGatewayProvider(key)(MODEL);
}

const DEFAULT_TIMEZONE = "Asia/Kolkata";

function normalizeTimeZone(timeZone: string | null | undefined): string {
  const candidate = timeZone?.trim();
  const resolved = !candidate || candidate === "UTC" ? DEFAULT_TIMEZONE : candidate;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: resolved }).format(new Date());
    return resolved;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function dateKeyFor(value: Date | string | null | undefined, timeZone = DEFAULT_TIMEZONE): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function timeZoneOffsetMs(value: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - value.getTime();
}

function zonedLocalTimeToIso(dayKey: string, hour: number, minute: number, timeZone: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const firstPass = new Date(utcGuess.getTime() - timeZoneOffsetMs(utcGuess, timeZone));
  return new Date(utcGuess.getTime() - timeZoneOffsetMs(firstPass, timeZone)).toISOString();
}

function openTasksDueToday<T extends { deadline: string | null; status: string }>(
  tasks: T[],
  todayKey: string,
  timeZone = DEFAULT_TIMEZONE,
): T[] {
  return tasks.filter((task) => task.status !== "done" && dateKeyFor(task.deadline, timeZone) === todayKey);
}

function withFreshConfidence<T extends { deadline: string | null; estimated_minutes: number; priority: number; status: string }>(task: T): T {
  return {
    ...task,
    risk_level: riskLevel(task),
    urgency_score: urgencyScore(task),
    estimated_completion_probability: completionProbability(task),
  };
}

async function logActivity(
  supabase: any,
  userId: string,
  agent: string,
  action: string,
  summary: string,
  taskId?: string | null,
) {
  await supabase.from("agent_activity").insert({
    user_id: userId,
    agent,
    action,
    summary,
    task_id: taskId ?? null,
  });
}

// ============= Recompute helpers =============
async function recomputeTaskScores(supabase: any, userId: string, taskId: string) {
  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("user_id", userId)
    .single();
  if (!task) return;
  const { data: subs } = await supabase
    .from("subtasks")
    .select("status,estimated_minutes")
    .eq("task_id", taskId);
  const subtasks = subs ?? [];
  const u = urgencyScore(task, subtasks);
  const r = riskLevel(task, subtasks);
  const p = completionProbability(task, subtasks);
  const proc = procrastinationRisk(task);
  await supabase
    .from("tasks")
    .update({
      urgency_score: u,
      risk_level: r,
      estimated_completion_probability: p,
      procrastination_risk: proc.risk,
      procrastination_reason: proc.reason,
      risk_detected_at:
        r === "high" || r === "critical" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);
}

// ============= CRUD =============
export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("deadline", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data ?? []).map(withFreshConfidence);
  });

export const getTask = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: task, error: te }, { data: subs, error: se }, { data: insights }] =
      await Promise.all([
        supabase.from("tasks").select("*").eq("id", data.id).eq("user_id", userId).single(),
        supabase.from("subtasks").select("*").eq("task_id", data.id).order("order_index"),
        supabase
          .from("ai_insights")
          .select("*")
          .eq("task_id", data.id)
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);
    if (te) throw te;
    if (se) throw se;
    return { task: task ? { ...task, estimated_completion_probability: completionProbability(task, subs ?? []) } : task, subtasks: subs ?? [], insights: insights ?? [] };
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().min(1),
        description: z.string().optional().nullable(),
        category: z.string().default("general"),
        priority: z.number().int().min(1).max(5).default(3),
        deadline: z.string().nullable().optional(),
        estimated_minutes: z.number().int().min(5).default(60),
        ai_generated: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inserted, error } = await supabase
      .from("tasks")
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    await recomputeTaskScores(supabase, userId, inserted.id);
    await logActivity(
      supabase,
      userId,
      data.ai_generated ? "Smart Capture" : "User",
      "Created task",
      `Created "${data.title}"`,
      inserted.id,
    );
    return inserted;
  });

export const updateTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "in_progress", "done", "missed"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const completed_at = data.status === "done" ? new Date().toISOString() : null;
    const { error } = await supabase
      .from("tasks")
      .update({ status: data.status, completed_at })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw error;
    await recomputeTaskScores(supabase, userId, data.id);
    await refreshProductivityAndStreak(supabase, userId);
    if (data.status === "done" || data.status === "missed") {
      const { data: t } = await supabase.from("tasks").select("title").eq("id", data.id).single();
      await logActivity(
        supabase,
        userId,
        data.status === "done" ? "Reflection" : "Rescue",
        data.status === "done" ? "Task completed" : "Task missed",
        `${data.status === "done" ? "Completed" : "Missed"} "${t?.title ?? "task"}"`,
        data.id,
      );
    }
    return { ok: true };
  });

async function refreshProductivityAndStreak(supabase: any, userId: string) {
  const { data: profileRaw } = await supabase.from("profiles").select("*").eq("id", userId).single();
  const profile = profileRaw as any;
  const timeZone = normalizeTimeZone(profile?.timezone);
  const todayKey = dateKeyFor(new Date(), timeZone);

  const { data: allTasks } = await supabase.from("tasks").select("id,status,completed_at,updated_at,estimated_minutes,deadline").eq("user_id", userId);
  const tasks = allTasks ?? [];
  const completedToday = tasks.filter((t: any) => t.status === "done" && dateKeyFor(t.completed_at, timeZone) === todayKey);
  const missedToday = tasks.filter((t: any) => t.status === "missed" && dateKeyFor(t.updated_at, timeZone) === todayKey);
  // Use all tasks scheduled or resolved today as the denominator so a single
  // completed task can't trivially push the score to 100%.
  const dueToday = tasks.filter((t: any) => t.deadline && dateKeyFor(t.deadline, timeZone) === todayKey);
  const resolvedIds = new Set([...completedToday, ...missedToday].map((t: any) => t.id));
  const pendingDueToday = dueToday.filter((t: any) => !resolvedIds.has(t.id) && t.status !== "done" && t.status !== "missed");
  const denom = completedToday.length + missedToday.length + pendingDueToday.length;
  const score = denom ? Math.round((completedToday.length / denom) * 100) : 0;
  const focus = completedToday.reduce((s: number, t: any) => s + (t.estimated_minutes ?? 0), 0);

  await supabase.from("productivity_metrics").upsert(
    { user_id: userId, date: todayKey, productivity_score: score, focus_minutes: focus, completed: completedToday.length, missed: missedToday.length },
    { onConflict: "user_id,date" },
  );

  // streak update
  if (completedToday.length > 0) {
    const last = profile?.last_active_date;
    let streak = profile?.streak_count ?? 0;
    if (last === todayKey) {
      // already counted today; ensure streak >= 1
      if (streak < 1) streak = 1;
    } else {
      const yesterdayKey = dateKeyFor(new Date(Date.now() - 24 * 3600 * 1000), timeZone);
      streak = last === yesterdayKey ? streak + 1 : 1;
    }
    await supabase.from("profiles").update({ streak_count: streak, last_active_date: todayKey } as any).eq("id", userId);
  }
}

export const toggleSubtask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), done: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sub, error } = await supabase
      .from("subtasks")
      .update({ status: data.done ? "done" : "pending" })
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("task_id")
      .single();
    if (error) throw error;
    if (sub?.task_id) await recomputeTaskScores(supabase, userId, sub.task_id);
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("tasks").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

// ============= AGENTS =============

/** Smart Task Capture Agent — NL → structured task */
export const captureTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().min(3) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString();
    const prompt = `You are the Smart Task Capture Agent. Extract a structured task from the user's natural-language description. Today is ${today}.
Return JSON with: title (short), category (one of: study, work, exam, project, personal, admin, interview, general), priority (1=low to 5=critical), estimated_minutes (integer), deadline (ISO 8601 datetime — guess a sensible time-of-day like 18:00 if only a date is given; null only if truly no time reference).
Input: """${data.text}"""
Respond with ONLY the JSON object, no prose.`;

    const { text } = await generateText({ model: getModel(), prompt });
    let parsed: any = {};
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      parsed = { title: data.text.slice(0, 80), category: "general", priority: 3, estimated_minutes: 60, deadline: null };
    }

    const payload = {
      title: String(parsed.title || data.text.slice(0, 80)),
      category: String(parsed.category || "general"),
      priority: Math.max(1, Math.min(5, Number(parsed.priority) || 3)),
      estimated_minutes: Math.max(15, Math.min(1440, Number(parsed.estimated_minutes) || 60)),
      deadline: parsed.deadline ?? null,
      description: data.text,
      ai_generated: true,
      user_id: userId,
    };

    const { data: inserted, error } = await supabase.from("tasks").insert(payload).select().single();
    if (error) throw error;
    await recomputeTaskScores(supabase, userId, inserted.id);
    await supabase.from("ai_insights").insert({
      user_id: userId,
      task_id: inserted.id,
      kind: "capture",
      content: { input: data.text, extracted: parsed },
    });
    await logActivity(supabase, userId, "Smart Capture", "Captured task", `Parsed "${payload.title}" from natural language`, inserted.id);
    return inserted;
  });

/** Planner Agent — break a task into subtasks */
export const planTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: task, error: te } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", data.taskId)
      .eq("user_id", userId)
      .single();
    if (te || !task) throw te ?? new Error("Task not found");

    const hrs = task.deadline
      ? Math.max(1, Math.round((new Date(task.deadline).getTime() - Date.now()) / 3600000))
      : 72;
    const prompt = `You are the Planner Agent. Break this task into 4-7 ordered subtasks that fit into the available time. Return strict JSON: { "subtasks": [{ "title": string, "estimated_minutes": int }], "strategy": string }.
Task: ${task.title}
Description: ${task.description ?? "(none)"}
Category: ${task.category}
Total budget: ${task.estimated_minutes} minutes
Hours until deadline: ${hrs}
Be specific and actionable. No prose outside the JSON.`;

    const { text } = await generateText({ model: getModel(), prompt });
    let plan: any = { subtasks: [], strategy: "" };
    try {
      plan = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      plan = { subtasks: [{ title: "Get started", estimated_minutes: task.estimated_minutes }], strategy: "Start with the smallest first step." };
    }

    await supabase.from("subtasks").delete().eq("task_id", task.id);
    const rows = (plan.subtasks ?? []).slice(0, 10).map((s: any, i: number) => ({
      task_id: task.id,
      user_id: userId,
      title: String(s.title || `Step ${i + 1}`),
      estimated_minutes: Math.max(5, Math.min(600, Number(s.estimated_minutes) || 30)),
      order_index: i,
    }));
    if (rows.length) await supabase.from("subtasks").insert(rows);
    await supabase.from("ai_insights").insert({
      user_id: userId,
      task_id: task.id,
      kind: "plan",
      content: { strategy: plan.strategy, subtasks: rows.map((r: any) => r.title) },
    });
    await recomputeTaskScores(supabase, userId, task.id);
    await logActivity(supabase, userId, "Planner", "Generated plan", `Planned "${task.title}" into ${rows.length} steps`, task.id);
    return { strategy: plan.strategy, subtasks: rows };
  });

/** Rescue Agent — compressed survival plan when risk is high */
export const generateRescuePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: task } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", data.taskId)
      .eq("user_id", userId)
      .single();
    if (!task) throw new Error("Task not found");
    const { data: subs } = await supabase
      .from("subtasks")
      .select("*")
      .eq("task_id", data.taskId)
      .order("order_index");
    const hrs = task.deadline
      ? Math.max(1, Math.round((new Date(task.deadline).getTime() - Date.now()) / 3600000))
      : 24;

    const prompt = `You are the Rescue Agent. The user is in danger of missing this deadline. Generate a compressed survival plan.
Return strict JSON: { "headline": string, "keep": [string], "skip": [string], "schedule": [{ "time": string, "action": string }], "final_review": string, "pep": string }.
- "keep" = highest-leverage items they MUST complete
- "skip" = nice-to-haves they should drop
- "schedule" = hour-by-hour blocks until the deadline (compressed, realistic)
- "final_review" = a clock time to do the last QA pass
- "pep" = one short motivational sentence
Task: ${task.title}
Description: ${task.description ?? "(none)"}
Hours until deadline: ${hrs}
Existing steps: ${(subs ?? []).map((s: any) => s.title).join(" | ") || "(none)"}
No prose outside JSON.`;

    const { text } = await generateText({ model: getModel(), prompt });
    let plan: any = {};
    try {
      plan = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      plan = { headline: "Emergency mode engaged", keep: ["Finish core deliverable"], skip: ["Optional polish"], schedule: [{ time: "Now", action: "Start the highest-value step" }], final_review: "1 hour before deadline", pep: "You can still make it." };
    }

    await supabase.from("tasks").update({ rescue_plan_generated: true }).eq("id", task.id);
    await supabase.from("ai_insights").insert({
      user_id: userId,
      task_id: task.id,
      kind: "rescue",
      content: plan,
    });
    await logActivity(supabase, userId, "Rescue", "Generated rescue plan", `Emergency plan for "${task.title}"`, task.id);
    return plan;
  });

/** Daily Brief — cached per (user, date) */
export const getOrCreateDailyBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ force: z.boolean().optional() }).optional().parse(d) ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const force = !!(data as any)?.force;
    const { data: profile } = await supabase.from("profiles").select("display_name,timezone").eq("id", userId).single();
    const timeZone = normalizeTimeZone(profile?.timezone);
    const today = dateKeyFor(new Date(), timeZone);
    const { data: tasks } = await supabase
      .from("tasks")
      .select("title,deadline,estimated_minutes,risk_level,priority,status")
      .eq("user_id", userId)
      .neq("status", "done")
      .order("deadline", { ascending: true });
    const openTasks = tasks ?? [];
    const dueTodayTasks = openTasksDueToday(openTasks, today, timeZone);
    const dueTodayHours = Math.round((dueTodayTasks.reduce((sum, task) => sum + (task.estimated_minutes ?? 0), 0) / 60) * 10) / 10;
    if (!force) {
      const { data: existing } = await supabase
        .from("daily_briefs")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();
      if (existing) {
        const existingContent = typeof existing.content === "object" && existing.content !== null ? existing.content : {};
        return { ...existingContent, deadlines_today: dueTodayTasks.length, workload_hours: dueTodayHours };
      }
    } else {
      await supabase.from("daily_briefs").delete().eq("user_id", userId).eq("date", today);
    }

    const list = openTasks.map((t) => `- ${t.title} | due ${t.deadline ?? "n/a"} | risk ${t.risk_level} | ~${t.estimated_minutes}m | due_today ${dateKeyFor(t.deadline, timeZone) === today ? "yes" : "no"}`).join("\n");

    const prompt = `You are the Daily Brief Agent for ${profile?.display_name ?? "the user"}. Generate a JSON object: { "greeting": string, "deadlines_today": int, "workload_hours": number, "top_risk": string, "suggested_first_action": string, "motivation": string }.
Deadlines today MUST be exactly ${dueTodayTasks.length}. Workload hours MUST be exactly ${dueTodayHours}.
Be specific, warm but not saccharine. Reference 1-2 task names where helpful.
Open tasks:
${list || "(none)"}
No prose outside JSON.`;

    const { text } = await generateText({ model: getModel(), prompt });
    let brief: any = {};
    try {
      brief = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      brief = {
        greeting: `Good day, ${profile?.display_name ?? "there"}.`,
        deadlines_today: 0,
        workload_hours: 0,
        top_risk: "Nothing critical right now.",
        suggested_first_action: "Add your first task with Smart Capture.",
        motivation: "Small starts beat perfect plans.",
      };
    }
    brief = { ...brief, deadlines_today: dueTodayTasks.length, workload_hours: dueTodayHours };

    await supabase.from("daily_briefs").upsert(
      { user_id: userId, date: today, content: brief },
      { onConflict: "user_id,date" },
    );
    await logActivity(supabase, userId, "Daily Brief", force ? "Regenerated brief" : "Generated brief", force ? "Regenerated today's AI brief" : "Created today's AI brief");
    return brief;
  });

/** Reflection Agent */
export const generateDailyReflection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: tasks } = await supabase
      .from("tasks")
      .select("title,status,completed_at,deadline")
      .eq("user_id", userId)
      .gte("updated_at", since);
    const completed = (tasks ?? []).filter((t) => t.status === "done");
    const missed = (tasks ?? []).filter((t) => t.status === "missed" || (t.deadline && new Date(t.deadline) < new Date() && t.status !== "done"));

    const prompt = `You are the Reflection Agent. Generate a short JSON: { "summary": string, "suggestions": [string, string, string], "tomorrow_priorities": [string, string, string] }.
Completed today: ${completed.map((t) => t.title).join(", ") || "(none)"}
Missed/overdue: ${missed.map((t) => t.title).join(", ") || "(none)"}
Be supportive, specific, concise. No prose outside JSON.`;

    const { text } = await generateText({ model: getModel(), prompt });
    let parsed: any = {};
    try { parsed = JSON.parse(text.replace(/```json|```/g, "").trim()); }
    catch { parsed = { summary: "A quiet day. Tomorrow is a fresh page.", suggestions: ["Plan tomorrow tonight", "Pick one focus task", "Sleep early"], tomorrow_priorities: [] }; }

    await supabase
      .from("reflections")
      .upsert({
        user_id: userId,
        date: today,
        summary: parsed.summary ?? "",
        completed_count: completed.length,
        missed_count: missed.length,
        suggestions: parsed,
      }, { onConflict: "user_id,date" });
    await logActivity(supabase, userId, "Reflection", "Generated reflection", "Daily reflection complete");
    return { ...parsed, completed: completed.length, missed: missed.length };
  });

// ============= Dashboard read =============
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const [{ data: tasks }, { data: profile }, { data: activity }, { data: metrics }] = await Promise.all([
      supabase.from("tasks").select("*").eq("user_id", userId),
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("agent_activity").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(15),
      supabase.from("productivity_metrics").select("*").eq("user_id", userId).gte("date", since.slice(0, 10)).order("date"),
    ]);

    const timeZone = normalizeTimeZone(profile?.timezone);
    const todayKey = dateKeyFor(new Date(), timeZone);
    const { data: brief } = await supabase.from("daily_briefs").select("content").eq("user_id", userId).eq("date", todayKey).maybeSingle();
    const all = (tasks ?? []).map(withFreshConfidence);
    const dueToday = openTasksDueToday(all, todayKey, timeZone);
    const upcoming = all.filter((t) => {
      if (!t.deadline || t.status === "done") return false;
      const deadline = new Date(t.deadline);
      return deadline > new Date() && dateKeyFor(deadline, timeZone) !== todayKey && deadline <= new Date(Date.now() + 7 * 24 * 3600 * 1000);
    });
    const completed = all.filter((t) => t.status === "done").length;
    const total = all.length;
    const productivityScore = total ? Math.round((completed / total) * 100) : 0;
    const riskTasks = all.filter((t) => (t.risk_level === "high" || t.risk_level === "critical") && t.status !== "done");
    const missedLast48h = all.filter((t) => t.status === "missed" && new Date(t.updated_at) > new Date(Date.now() - 48 * 3600 * 1000)).length;

    // Pick the live top risk: prefer due-today, then any open task, ranked by urgency.
    const rankPool = (dueToday.length ? dueToday : all.filter((t) => t.status !== "done" && t.deadline));
    const topRiskTask = [...rankPool].sort((a: any, b: any) => (b.urgency_score ?? 0) - (a.urgency_score ?? 0))[0];
    const topRiskTitle = topRiskTask?.title ?? "Nothing critical right now.";

    const briefContent = typeof brief?.content === "object" && brief.content !== null ? brief.content : null;
    const coherentBrief = briefContent
      ? {
          ...briefContent,
          deadlines_today: dueToday.length,
          workload_hours: Math.round((dueToday.reduce((sum, task) => sum + (task.estimated_minutes ?? 0), 0) / 60) * 10) / 10,
          top_risk: topRiskTitle,
        }
      : null;

    return {
      profile,
      todayKey,
      tasks: all,
      dueToday,
      upcoming,
      riskTasks,
      productivityScore,
      streak: profile?.streak_count ?? 0,
      activity: activity ?? [],
      metrics: metrics ?? [],
      brief: coherentBrief,
      missedLast48h,
    };
  });

// ============= Demo seed =============
export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("display_name,timezone").eq("id", userId).single();
    const timeZone = normalizeTimeZone(profile?.timezone);
    // Wipe existing demo
    await supabase.from("tasks").delete().eq("user_id", userId);
    await supabase.from("daily_briefs").delete().eq("user_id", userId);
    await supabase.from("agent_activity").delete().eq("user_id", userId);
    await supabase.from("reflections").delete().eq("user_id", userId);
    await supabase.from("productivity_metrics").delete().eq("user_id", userId);

    const now = Date.now();
    const hours = (h: number) => new Date(now + h * 3600 * 1000).toISOString();
    // Anchor demo deadlines to today's saved timezone so Dashboard, Brief, and Today's Tasks agree.
    const todayAt = (h: number, m = 0) => {
      const day = dateKeyFor(new Date(now), timeZone);
      return zonedLocalTimeToIso(day, h, m, timeZone);
    };
    const seed = [
      { title: "DBMS Assignment — Normalization & ER diagrams", description: "Submit assignment with ER diagrams, BCNF examples, and write-up.", category: "study", priority: 5, deadline: todayAt(21, 0), estimated_minutes: 240 },
      { title: "OS Exam Preparation", description: "Cover process scheduling, memory management, file systems.", category: "exam", priority: 5, deadline: hours(5 * 24), estimated_minutes: 600 },
      { title: "Placement Interview — System Design Round", description: "Prep for Friday's interview: design a URL shortener and a chat app.", category: "interview", priority: 4, deadline: hours(3 * 24), estimated_minutes: 300 },
      { title: "Mini Project — Build chat feature", description: "Late-night coding session for the mini project.", category: "project", priority: 3, deadline: new Date(new Date(now + 2 * 24 * 3600 * 1000).setHours(23, 30, 0, 0)).toISOString(), estimated_minutes: 180 },
      { title: "Lab Submission — File I/O", description: "Submit Lab 6 with screenshots and code.", category: "study", priority: 3, deadline: todayAt(18, 30), estimated_minutes: 90 },
      { title: "Read research paper for seminar", description: "Skim and take notes on the recommended paper.", category: "study", priority: 2, deadline: todayAt(16, 0), estimated_minutes: 60 },
    ];

    const rows = seed.map((s) => ({ ...s, user_id: userId, ai_generated: false }));
    const { data: inserted } = await supabase.from("tasks").insert(rows).select();

    // Recompute scores
    for (const t of inserted ?? []) await recomputeTaskScores(supabase, userId, t.id);

    // Activity feed prefill
    const activityRows = [
      { agent: "Planner", action: "Generated plan", summary: "Planned 'DBMS Assignment' into 5 steps" },
      { agent: "Smart Capture", action: "Captured task", summary: "Parsed 'OS Exam Preparation' from natural language" },
      { agent: "Rescue", action: "Risk detected", summary: "DBMS Assignment marked critical" },
      { agent: "Reflection", action: "Generated reflection", summary: "Yesterday's reflection complete" },
      { agent: "Daily Brief", action: "Generated brief", summary: "Created today's AI brief" },
      { agent: "Planner", action: "Generated plan", summary: "Planned 'Placement Interview' into 4 steps" },
      { agent: "Smart Capture", action: "Captured task", summary: "Parsed 'Lab Submission' from natural language" },
      { agent: "Rescue", action: "High procrastination risk", summary: "Mini Project scheduled late at night" },
    ];
    await supabase.from("agent_activity").insert(activityRows.map((a) => ({ ...a, user_id: userId })));

    // Profile name (best-effort)
    const name = profile?.display_name?.split(" ")[0] ?? "there";

    // Today's daily brief — pre-baked so the dashboard is never empty in demos
    const today = dateKeyFor(new Date(), timeZone);
    const demoDueToday = openTasksDueToday(inserted ?? [], today, timeZone);
    const demoWorkloadHours = Math.round((demoDueToday.reduce((sum, task) => sum + (task.estimated_minutes ?? 0), 0) / 60) * 10) / 10;
    const briefContent = {
      greeting: `🌅 Good morning, ${name}`,
      deadlines_today: demoDueToday.length,
      workload_hours: demoWorkloadHours,
      top_risk: "DBMS Assignment — Normalization & ER diagrams",
      suggested_first_action: "Finish the ER diagrams before noon — it unblocks the rest of the assignment.",
      motivation: "Momentum beats motivation. Start with one diagram.",
    };
    await supabase.from("daily_briefs").upsert(
      { user_id: userId, date: today, content: briefContent },
      { onConflict: "user_id,date" },
    );

    // Yesterday's reflection
    const yesterday = new Date(now - 24 * 3600 * 1000).toISOString().slice(0, 10);
    await supabase.from("reflections").upsert(
      {
        user_id: userId,
        date: yesterday,
        summary: "Solid morning — you shipped the lab submission. Late-night coding on the mini project slipped again, which is the second time this week.",
        completed_count: 3,
        missed_count: 1,
        suggestions: {
          suggestions: [
            "Move coding tasks to the afternoon when focus is highest.",
            "Cap late-night work at 11pm to protect tomorrow's energy.",
            "Batch admin tasks into one 30-minute block.",
          ],
          tomorrow_priorities: [
            "Finish DBMS ER diagrams before noon",
            "1 hour of OS exam prep",
            "Quick review of the system design interview notes",
          ],
        },
      },
      { onConflict: "user_id,date" },
    );

    // Seven days of productivity metrics for richer charts
    const metrics = [
      { offset: 6, score: 45, completed: 1, missed: 2 },
      { offset: 5, score: 52, completed: 2, missed: 1 },
      { offset: 4, score: 48, completed: 3, missed: 2 },
      { offset: 3, score: 61, completed: 2, missed: 1 },
      { offset: 2, score: 72, completed: 4, missed: 0 },
      { offset: 1, score: 80, completed: 1, missed: 1 },
      { offset: 0, score: 85, completed: 3, missed: 0 },
    ].map((m) => ({
      user_id: userId,
      date: dateKeyFor(new Date(now - m.offset * 24 * 3600 * 1000), timeZone),
      productivity_score: m.score,
      focus_minutes: 60 + m.completed * 30,
      completed: m.completed,
      missed: m.missed,
    }));
    await supabase.from("productivity_metrics").upsert(metrics, { onConflict: "user_id,date" });

    return { ok: true, count: inserted?.length ?? 0 };
  });

// ============= Activity feed =============
export const listActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("agent_activity")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });

export const listReflections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("reflections")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(30);
    return data ?? [];
  });