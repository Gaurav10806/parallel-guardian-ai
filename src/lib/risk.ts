// Deterministic helpers for urgency, risk, procrastination, AI confidence, burnout.
// Pure functions — safe to use on both server and client.

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface TaskLike {
  deadline: string | null;
  estimated_minutes: number;
  priority: number;
  status: string;
  category?: string | null;
  created_at?: string;
}

export interface SubtaskLike {
  status: string;
  estimated_minutes: number;
}

const HOUR_MS = 60 * 60 * 1000;

export function remainingMinutes(task: TaskLike, subtasks: SubtaskLike[] = []): number {
  if (!subtasks.length) return task.estimated_minutes;
  const done = subtasks.filter((s) => s.status === "done").reduce((a, s) => a + s.estimated_minutes, 0);
  const total = subtasks.reduce((a, s) => a + s.estimated_minutes, 0) || task.estimated_minutes;
  return Math.max(0, total - done);
}

export function hoursUntil(deadline: string | null): number {
  if (!deadline) return 9999;
  return (new Date(deadline).getTime() - Date.now()) / HOUR_MS;
}

export function urgencyScore(task: TaskLike, subtasks: SubtaskLike[] = []): number {
  const hrs = Math.max(0.1, hoursUntil(task.deadline));
  const rem = remainingMinutes(task, subtasks) / 60;
  const proximity = Math.min(10, 24 / hrs);
  return Math.round((proximity * task.priority * Math.max(0.5, rem)) * 10) / 10;
}

export function riskLevel(task: TaskLike, subtasks: SubtaskLike[] = []): RiskLevel {
  if (task.status === "done") return "low";
  const hrs = hoursUntil(task.deadline);
  const remHrs = remainingMinutes(task, subtasks) / 60;
  if (hrs < 0) return "critical";
  if (hrs < 2) return "critical";
  if (hrs < 6) return "high";
  if (hrs < 12 && remHrs > 1) return "critical";
  if (hrs < 24 && remHrs > 2) return "high";
  if (hrs < 48 && remHrs > 4) return "medium";
  if (hrs < 72) return "medium";
  return "low";
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function completionProbability(
  task: TaskLike,
  subtasks: SubtaskLike[] = [],
  history: { completionRate: number; recentMissed: number } = { completionRate: 0.7, recentMissed: 0 },
): number {
  const hrs = Math.max(0.1, hoursUntil(task.deadline));
  const remHrs = remainingMinutes(task, subtasks) / 60;
  const ratio = hrs / Math.max(0.5, remHrs); // > 1 means time-rich
  const deadlineHour = task.deadline ? new Date(task.deadline).getHours() : 12;
  const lateDeadline = deadlineHour >= 21 || deadlineHour <= 5;
  const categoryPenalty = task.category === "exam" ? 0.18 : 0;
  // Tighter, more realistic curve — strong cap, no 100% certainty.
  const score =
    0.6 * Math.log(Math.max(0.1, ratio)) +
    0.75 * (history.completionRate - 0.5) -
    0.5 * history.recentMissed -
    (task.priority >= 4 ? 0.3 : 0) -
    (remHrs > 3 ? 0.2 : 0) -
    (lateDeadline ? 0.35 : 0) -
    categoryPenalty;
  const p = logistic(score);
  // Squash into a believable 16%–88% band.
  const bounded = Math.min(0.88, 0.16 + p * 0.72);
  return Math.round(bounded * 100) / 100;
}

export function procrastinationRisk(
  task: TaskLike,
  history: { categoryMissRate: number; recentProductivity: number } = { categoryMissRate: 0.3, recentProductivity: 60 },
): { risk: number; reason: string } {
  if (!task.deadline) return { risk: 0.2, reason: "No deadline set — easy to defer indefinitely." };
  const hour = new Date(task.deadline).getHours();
  const lateNight = hour >= 21 || hour <= 5 ? 0.25 : 0;
  const lowProd = task.status !== "done" && history.recentProductivity < 50 ? 0.2 : 0;
  const catRisk = history.categoryMissRate * 0.5;
  const base = 0.15;
  const risk = Math.min(0.95, base + lateNight + lowProd + catRisk);

  const reasons: string[] = [];
  if (lateNight) reasons.push(`scheduled ${hour >= 21 ? "late at night" : "in early morning hours"}`);
  if (catRisk > 0.15) reasons.push(`${task.category ?? "this type of"} tasks are often missed`);
  if (lowProd) reasons.push("recent productivity is below average");
  const reason = reasons.length
    ? `Likely to slip — ${reasons.join("; ")}.`
    : "Low procrastination risk based on your history.";
  return { risk: Math.round(risk * 100) / 100, reason };
}

export function confidenceColor(p: number): "green" | "yellow" | "red" {
  if (p >= 0.8) return "green";
  if (p >= 0.5) return "yellow";
  return "red";
}

export function explainCritical(
  task: TaskLike,
  subtasks: SubtaskLike[] = [],
): string[] {
  const reasons: string[] = [];
  const hrs = hoursUntil(task.deadline);
  if (hrs < 0) reasons.push("Deadline already passed");
  else if (hrs < 24) reasons.push(`Due in ${Math.max(1, Math.round(hrs))}h`);
  else if (hrs < 72) reasons.push(`Due in ${Math.round(hrs / 24)}d`);

  const remHrs = remainingMinutes(task, subtasks) / 60;
  const totalHrs = task.estimated_minutes / 60;
  if (totalHrs > 0) {
    const pct = Math.round((remHrs / totalHrs) * 100);
    if (pct > 50) reasons.push(`${pct}% of work remaining`);
  }
  if (task.priority >= 4) reasons.push("High-priority task");
  if (task.status === "missed") reasons.push("Previously marked missed");
  return reasons.length ? reasons : ["On track — keep going."];
}

export function burnoutSignal(
  missedLast48h: number,
  productivityScore: number,
): { active: boolean; reductionPct: number; reason: string } {
  if (missedLast48h > 4) {
    return {
      active: true,
      reductionPct: 40,
      reason: `${missedLast48h} missed tasks in the last 48 hours — strong overload signal.`,
    };
  }
  if (productivityScore < 30) {
    return {
      active: true,
      reductionPct: 30,
      reason: `Productivity score is ${productivityScore}/100 — energy looks low.`,
    };
  }
  return { active: false, reductionPct: 0, reason: "" };
}