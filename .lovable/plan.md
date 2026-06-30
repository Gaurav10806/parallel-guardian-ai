
# Parallel Guardian AI: Deadline Guardian — Core MVP (FROZEN)

Scope locked. From here: build, polish, fix, rehearse — no new features.

## Stack

- TanStack Start (existing template)
- Lovable Cloud (Supabase) — auth, Postgres, RLS
- Lovable AI Gateway — `google/gemini-3-flash-preview`
- shadcn/ui + Tailwind v4 + framer-motion + recharts
- Auth: Email/password + managed Google sign-in
- Fonts: `@fontsource/space-grotesk` + `@fontsource/inter`

## Design direction

Futuristic dark-first. Near-black canvas, single violet→cyan hot gradient accent, subtle grid texture, glassmorphism cards. Space Grotesk display + Inter body. Framer-motion for hero, "See AI Think" pipeline, agent thinking shimmer, card hover lift, activity feed slide-in.

## Routes

```text
/                          Landing
/auth                      Sign in / up (email + Google)
/_authenticated/
  dashboard                Brief → Stats → Risk → Today → Charts → Wellness (+ Activity Feed)
  tasks                    List + Smart Capture composer
  tasks/$taskId            Detail + AI plan + rescue plan + AI Confidence + explainability
  reflections              Daily reflection history
  settings                 Profile, theme, demo seed, sign out
```

## Database (RLS scoped to auth.uid(); GRANTs to authenticated + service_role)

- `profiles` (id=auth.users.id, display_name, avatar_url, timezone, streak_count, created_at)
- `tasks` (id, user_id, title, description, category, priority 1-5, urgency_score, risk_level, risk_detected_at, rescue_plan_generated bool, ai_generated bool, estimated_completion_probability numeric, procrastination_risk numeric, procrastination_reason text, status, deadline timestamptz, estimated_minutes int, completed_at, created_at)
- `subtasks` (id, task_id, user_id, title, status, order_index, estimated_minutes)
- `ai_insights` (id, user_id, task_id nullable, kind ['plan'|'rescue'|'brief'|'reflection'|'capture'], content jsonb, created_at)
- `daily_briefs` (id, user_id, date, content jsonb, created_at, UNIQUE(user_id, date))
- `reflections` (id, user_id, date, summary, completed_count int, missed_count int, suggestions jsonb, created_at)
- `productivity_metrics` (id, user_id, date, productivity_score int, focus_minutes int, completed int, missed int)
- `agent_activity` (id, user_id, agent, action, summary, task_id nullable, created_at)

Trigger auto-creates `profiles` on signup. Every agent server fn appends an `agent_activity` row.

## AI agents (4 LLM agents via Gemini)

In `src/lib/agents.functions.ts` with `requireSupabaseAuth`. Provider helper in `src/lib/ai-gateway.server.ts`.

1. **Planner Agent** — `planTask({ taskId })`: subtasks + day-by-day schedule.
2. **Smart Task Capture Agent** — `captureTask({ text })`: extracts `{ title, deadline, priority, estimated_minutes, category }`, inserts task with `ai_generated=true`.
3. **Reflection Agent** — `generateDailyReflection()`: summary + suggestions + tomorrow's priorities.
4. **Rescue Agent ⭐** — `generateRescuePlan({ taskId })`: keep/skip + hour-by-hour + final review time.

### Deterministic helpers (no LLM)

- **Urgency score** — deadline proximity × priority × remaining effort.
- **Risk level** — hours-to-deadline vs remaining effort + subtask % + missed count.
- **Procrastination risk** — `late_night + historical_miss_rate + low_recent_productivity` → 0-100% + reason line.
- **Burnout signal** — `>4 missed in 2d` OR `productivity_score < 30` → Wellness card.
- **AI Confidence** (`estimated_completion_probability`) — logistic over time/effort/history/procrastination; rendered as "AI Success Prediction" with traffic-light color (>80 green, 50-80 yellow, <50 red).
- **Explainability** — "Why?" popover lists the 2-3 driving factors.

## Dashboard order

1. Today's AI Brief hero card (cached per day).
2. Stats — Due today, Upcoming 7d, Productivity score, Streak.
3. Deadline Risk Alerts 🚨 — high/critical tasks with "Generate Rescue Plan" + "Why critical?".
4. Today's Tasks — checklist with procrastination chip.
5. Charts — weekly completion bar, completion-rate line.
6. AI Wellness Monitor — appears only when burnout signal fires.
7. AI Activity Feed — right rail (desktop) / drawer (mobile), newest-first.

## Tasks page

- Composer toggles: structured form ↔ "Describe it" → Smart Task Capture.
- Row: urgency + risk badges, deadline countdown, procrastination chip, "Plan with AI", "Rescue" (when risk ≥ high), "Why?".
- Detail: AI Success Prediction card at top, subtasks checklist, AI plan, rescue plan, explainability panel, complete/missed actions.

## Landing

- **Hero** — H1 "Never Miss Another Deadline Again." / Sub "Parallel Guardian AI is an autonomous AI productivity companion that predicts risks, rescues missed work, and helps you finish what matters before deadlines collapse." / Tag "Plan smarter. Recover faster. Stay ahead." / CTA → /auth / **Trust line under buttons: "Powered by Gemini · Built for students, professionals, and creators."**
- "See AI Think" scroll-triggered pipeline animation.
- Agent showcase (Planner / Smart Capture / Reflection / Rescue ⭐).
- How It Works (3-step).
- **Powered By Google** badges with one-liners: Gemini 2.5 Flash · Google AI Studio · Google OAuth · Google Cloud Deployment · Google Cloud Infrastructure.
- Footer CTA.

## Empty states (every list/card)

- Risk Alerts: "No high-risk tasks detected 🎉 You're currently on track."
- Activity Feed: "No AI activity yet. Create your first task to get started."
- Today's Tasks: "Nothing due today. Plan something or enjoy the calm."
- Reflections history: "No reflections yet. Run today's reflection from the dashboard."
- Tasks list: "No tasks yet. Use Smart Capture to describe one in plain English."
- Wellness Monitor: hidden entirely when no burnout signal (positive empty state).
- Subtasks on detail: "No subtasks yet. Click Plan with AI to break this down."

All empty states use a muted icon + one-line copy + primary CTA where useful.

## Demo mode (rehearsed flow)

Persistent "Demo Mode" banner in authenticated layout with **Load Student Scenario** button. `seedDemoData()` inserts OS Exam, DBMS Assignment (critical risk, 32% confidence), Placement Interview, Mini Project (high procrastination risk), Lab Submission + today's brief + a reflection + 8 activity rows.

Rehearsed sequence:
1. Load Student Scenario.
2. Open DBMS Assignment → show Risk + 32% AI Success Prediction.
3. Click Generate Rescue Plan → hour-by-hour plan.
4. Back to dashboard → Brief, Activity Feed, Wellness Monitor.
5. Smart Capture: "I have a DBMS viva on Friday and need 6 hours of preparation." → show extraction.
6. Landing → scroll "See AI Think" animation.

## Build order

1. Auth + DB + Landing + Dashboard skeleton + Tasks CRUD.
2. Smart Task Capture + Planner.
3. Daily Brief + Reflection.
4. Risk detection + AI Confidence + Rescue Agent + explainability.
5. Burnout card + Activity Feed + charts + demo seed.
6. Empty states, animations, polish, mobile responsiveness, demo rehearsal.

## Out of scope (locked)

Voice, habits, Pomodoro, semantic memory / vector DB, Google Calendar sync, additional agents, Vertex AI, Cloud Run, Firebase, pricing page.

## Technical notes

- Enable Lovable Cloud; configure Google via `supabase--configure_social_auth` in same turn Google sign-in is added.
- `_authenticated/route.tsx` is integration-managed.
- All AI calls via gateway helper; `LOVABLE_API_KEY` stays server-side.
- Planner/Rescue/Reflection/Capture use AI SDK `Output.object` with small Zod schemas.
- Daily Brief cached per (user, date).
- Every agent fn writes to `agent_activity`.
