import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export function GlassCard({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("glass rounded-2xl p-5 shadow-card", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, kicker }: { children: React.ReactNode; kicker?: string }) {
  return (
    <div className="mb-3">
      {kicker && <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">{kicker}</div>}
      <div className="text-lg font-display font-semibold tracking-tight">{children}</div>
    </div>
  );
}

export function EmptyState({ title, body, icon: Icon = Sparkles, action }: { title: string; body: string; icon?: any; action?: React.ReactNode }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="mx-auto size-10 grid place-items-center rounded-full bg-white/5 mb-3">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{body}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    low: "bg-white/10 text-muted-foreground",
    medium: "bg-accent/15 text-accent",
    high: "bg-amber-500/20 text-amber-300",
    critical: "bg-destructive/20 text-destructive",
  };
  return (
    <span className={cn("text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full", map[level] ?? map.low)}>
      {level}
    </span>
  );
}

export function Shimmer() {
  return (
    <motion.div
      className="h-1 rounded-full bg-gradient-hot"
      initial={{ width: "10%" }}
      animate={{ width: ["10%", "90%", "10%"] }}
      transition={{ duration: 1.6, repeat: Infinity }}
    />
  );
}

export function fmtCountdown(deadline: string | null): string {
  if (!deadline) return "no deadline";
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms < 0) {
    const h = Math.round(-ms / 3600000);
    return `overdue ${h < 24 ? `${h}h` : `${Math.round(h / 24)}d`}`;
  }
  const h = ms / 3600000;
  if (h < 1) return `${Math.round(ms / 60000)}m left`;
  if (h < 48) return `${Math.round(h)}h left`;
  return `${Math.round(h / 24)}d left`;
}