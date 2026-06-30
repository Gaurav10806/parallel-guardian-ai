import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Brain, ShieldAlert, Sparkles, Wand2, ListChecks, Activity, Heart, Zap, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Parallel Guardian AI — Never Miss Another Deadline" },
      { name: "description", content: "An autonomous AI productivity companion that predicts risks, rescues missed work, and helps you finish what matters before deadlines collapse." },
      { property: "og:title", content: "Parallel Guardian AI" },
      { property: "og:description", content: "Plan smarter. Recover faster. Stay ahead. Powered by Gemini." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <Nav />
      <Hero />
      <SeeAiThink />
      <Agents />
      <HowItWorks />
      <PoweredByGoogle />
      <FinalCta />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/60 border-b border-border/60">
      <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-gradient-hot shadow-glow" />
          <span className="font-display font-semibold tracking-tight">Parallel Guardian</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
          <Link to="/auth">
            <Button size="sm" className="bg-gradient-hot text-background hover:opacity-90">Get started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative grid-bg">
      <div className="max-w-6xl mx-auto px-5 pt-20 pb-28 text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground mb-6"
        >
          <Sparkles className="size-3 text-accent" /> Autonomous agentic productivity · Powered by Gemini
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="text-4xl sm:text-6xl md:text-7xl font-display font-semibold tracking-tight leading-[1.05]"
        >
          Never miss another <br className="hidden sm:block" />
          <span className="text-gradient">deadline</span> again.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground"
        >
          Parallel Guardian AI is an autonomous productivity companion that predicts risks, rescues missed work, and helps you finish what matters before deadlines collapse.
        </motion.p>
        <div className="mt-4 text-sm text-foreground/80 font-medium">Plan smarter. Recover faster. Stay ahead.</div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" className="bg-gradient-hot text-background hover:opacity-90 shadow-glow">
              Start free <ArrowRight className="ml-1 size-4" />
            </Button>
          </Link>
          <a href="#see-ai-think">
            <Button size="lg" variant="outline">See AI think</Button>
          </a>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Powered by Gemini · Built for students, professionals, and creators
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

function HeroPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.3 }}
      className="mt-14 mx-auto max-w-4xl glass-strong rounded-2xl p-5 sm:p-8 text-left shadow-card"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-muted-foreground">Today's AI Brief</div>
        <div className="text-xs text-accent">live</div>
      </div>
      <div className="font-display text-2xl sm:text-3xl tracking-tight">Good morning, Gaurav 👋</div>
      <div className="mt-2 text-muted-foreground text-sm">
        You have <span className="text-foreground">3 deadlines today</span> and ~<span className="text-foreground">5 hours</span> of estimated workload.
        High risk: <span className="text-destructive">DBMS Assignment</span>.
      </div>
      <div className="mt-5 grid sm:grid-cols-2 gap-3">
        <PreviewCard icon={ShieldAlert} title="DBMS Assignment" body="Due in 18h · 70% remaining" tone="critical" />
        <PreviewCard icon={Brain} title="Rescue Plan" body="Finish ER diagrams · Skip optional polish · Review at 8 PM" tone="accent" />
      </div>
    </motion.div>
  );
}

function PreviewCard({ icon: Icon, title, body, tone }: { icon: any; title: string; body: string; tone: "critical" | "accent" }) {
  return (
    <div className={`rounded-xl p-4 border border-border/60 ${tone === "critical" ? "bg-destructive/10" : "bg-gradient-soft"}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className={`size-4 ${tone === "critical" ? "text-destructive" : "text-accent"}`} />
        {title}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{body}</div>
    </div>
  );
}

function SeeAiThink() {
  const steps = [
    { icon: ListChecks, label: "Capture", body: "Plain-English task input" },
    { icon: Brain, label: "Analyze", body: "Parse intent · estimate effort" },
    { icon: Wand2, label: "Schedule", body: "Build day-by-day plan" },
    { icon: Activity, label: "Predict", body: "Procrastination & risk scores" },
    { icon: ShieldAlert, label: "Rescue", body: "Compress to survival plan" },
    { icon: CheckCircle2, label: "Track", body: "Completion + reflection" },
  ];
  return (
    <section id="see-ai-think" className="py-24 border-t border-border/60">
      <div className="max-w-6xl mx-auto px-5 text-center">
        <h2 className="text-3xl sm:text-5xl font-display font-semibold tracking-tight">See the AI <span className="text-gradient">think</span></h2>
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">Six autonomous steps run behind every task — so you stay focused while the system stays vigilant.</p>
        <div className="mt-12 grid grid-cols-2 md:grid-cols-6 gap-3 sm:gap-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="glass rounded-xl p-4 text-left"
            >
              <div className="size-8 grid place-items-center rounded-lg bg-gradient-soft mb-3">
                <s.icon className="size-4" />
              </div>
              <div className="text-xs text-muted-foreground">Step {i + 1}</div>
              <div className="font-medium">{s.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.body}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Agents() {
  const agents = [
    { icon: Wand2, name: "Planner Agent", body: "Breaks any goal into ordered, time-budgeted subtasks." },
    { icon: Sparkles, name: "Smart Task Capture", body: "Reads natural language and structures it into a real task." },
    { icon: Brain, name: "Reflection Agent", body: "Generates daily summaries, suggestions, and tomorrow's priorities." },
    { icon: ShieldAlert, name: "Rescue Agent ⭐", body: "Emergency mode — compressed survival plan when deadlines collapse." },
  ];
  return (
    <section className="py-24 border-t border-border/60">
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-5xl font-display font-semibold tracking-tight">Four agents. One mission.</h2>
          <p className="mt-3 text-muted-foreground">Help you actually finish what matters.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {agents.map((a) => (
            <motion.div key={a.name} whileHover={{ y: -3 }} className="glass rounded-2xl p-6">
              <div className="size-10 grid place-items-center rounded-lg bg-gradient-hot text-background mb-4">
                <a.icon className="size-5" />
              </div>
              <div className="font-display text-xl">{a.name}</div>
              <p className="text-sm text-muted-foreground mt-2">{a.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { title: "Capture in plain English", body: "Tell Parallel Guardian what's on your plate — exam, assignment, interview. The Smart Capture Agent structures it instantly." },
    { title: "Let the AI plan & predict", body: "The Planner breaks it into steps. Deterministic risk + procrastination scoring run on every change." },
    { title: "Rescue when things slip", body: "When risk hits critical, the Rescue Agent generates an hour-by-hour survival plan with what to keep and skip." },
  ];
  return (
    <section className="py-24 border-t border-border/60">
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-5xl font-display font-semibold tracking-tight">How it works</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {steps.map((s, i) => (
            <div key={s.title} className="glass rounded-2xl p-6">
              <div className="text-xs text-muted-foreground">Step {i + 1}</div>
              <div className="font-display text-xl mt-1">{s.title}</div>
              <p className="text-sm text-muted-foreground mt-2">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PoweredByGoogle() {
  const badges = [
    { name: "Gemini 2.5 Flash", body: "Agentic reasoning & generation" },
    { name: "Google AI Studio", body: "Prompt design & evaluation" },
    { name: "Google OAuth", body: "Secure single sign-on" },
    { name: "Google Cloud Deployment", body: "Production hosting" },
    { name: "Google Cloud Infrastructure", body: "Scalable backend" },
  ];
  return (
    <section className="py-24 border-t border-border/60">
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center mb-10">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Powered by Google</div>
          <h2 className="mt-2 text-3xl sm:text-5xl font-display font-semibold tracking-tight">Built on the Google stack</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {badges.map((b) => (
            <div key={b.name} className="glass rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Zap className="size-4 text-accent" />
                {b.name}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{b.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="py-24 border-t border-border/60">
      <div className="max-w-3xl mx-auto px-5 text-center">
        <Heart className="size-6 mx-auto text-accent mb-4" />
        <h2 className="text-3xl sm:text-5xl font-display font-semibold tracking-tight">Your AI chief-of-staff is waiting.</h2>
        <p className="mt-3 text-muted-foreground">Sign in, load the student scenario, and watch Parallel Guardian go to work.</p>
        <div className="mt-7 flex justify-center">
          <Link to="/auth">
            <Button size="lg" className="bg-gradient-hot text-background hover:opacity-90 shadow-glow">
              Open your dashboard <ArrowRight className="ml-1 size-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-10 border-t border-border/60 text-center text-xs text-muted-foreground">
      © {new Date().getFullYear()} Parallel Guardian AI · Built for Vibe2Ship
    </footer>
  );
}
