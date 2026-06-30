import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { LayoutDashboard, ListChecks, Sparkles, Settings, LogOut, Shield } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { seedDemoData } from "@/lib/agents.functions";
import { toast } from "sonner";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/reflections", label: "Reflections", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  const seed = useMutation({
    mutationFn: () => seedDemoData(),
    onSuccess: () => {
      toast.success("Student scenario loaded");
      qc.invalidateQueries();
      router.invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to load demo"),
  });

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border/60 glass-strong">
        <Link to="/dashboard" className="px-5 py-5 flex items-center gap-2 hover:opacity-90 transition-opacity">
          <div className="size-8 rounded-md bg-gradient-hot grid place-items-center shadow-glow">
            <Shield className="size-4 text-background" />
          </div>
          <div className="font-display font-semibold tracking-tight">Parallel Guardian</div>
        </Link>
        <nav className="flex-1 px-3 space-y-1">
          {nav.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                  active ? "bg-gradient-soft text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                )}
              >
                <n.icon className="size-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={signOut}>
            <LogOut className="size-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Demo banner */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 sm:px-6 py-2 text-xs flex items-center gap-3 justify-between border-b border-border/60 bg-gradient-soft"
        >
          <div className="flex items-center gap-2">
            <span className="inline-block size-1.5 rounded-full bg-accent animate-pulse" />
            <span className="font-medium">Demo Mode</span>
            <span className="text-muted-foreground hidden sm:inline">— preload a realistic student scenario to explore every AI feature.</span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-7"
            disabled={seed.isPending}
            onClick={() => seed.mutate()}
          >
            {seed.isPending ? "Loading…" : "Load Student Scenario"}
          </Button>
        </motion.div>

        {/* Mobile top nav */}
        <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-border/60 overflow-x-auto">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs whitespace-nowrap",
                pathname.startsWith(n.to) ? "bg-gradient-hot text-background" : "bg-white/5 text-muted-foreground",
              )}
            >
              <n.icon className="size-3.5" />
              {n.label}
            </Link>
          ))}
        </div>

        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}