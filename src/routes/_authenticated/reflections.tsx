import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { generateDailyReflection, listReflections } from "@/lib/agents.functions";
import { GlassCard, SectionTitle, EmptyState, Shimmer } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reflections")({
  head: () => ({ meta: [{ title: "Reflections — Parallel Guardian AI" }] }),
  component: ReflectionsPage,
});

function ReflectionsPage() {
  const qc = useQueryClient();
  const { data: reflections = [] } = useQuery({ queryKey: ["reflections"], queryFn: () => listReflections() });
  const gen = useMutation({
    mutationFn: () => generateDailyReflection(),
    onSuccess: () => { toast.success("Reflection generated"); qc.invalidateQueries({ queryKey: ["reflections"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Reflections</h1>
          <p className="text-sm text-muted-foreground">Daily AI summaries, suggestions, and tomorrow's priorities.</p>
        </div>
        <Button className="bg-gradient-hot text-background" disabled={gen.isPending} onClick={() => gen.mutate()}>
          {gen.isPending ? "Thinking…" : "Run today's reflection"}
        </Button>
      </div>
      {gen.isPending && (
        <GlassCard><div className="space-y-2"><Shimmer /><div className="text-xs text-muted-foreground">Reflection Agent thinking…</div></div></GlassCard>
      )}
      {reflections.length === 0 ? (
        <GlassCard><EmptyState title="No reflections yet" body="Run today's reflection from the button above." icon={Sparkles} /></GlassCard>
      ) : (
        <div className="space-y-3">
          {reflections.map((r: any) => (
            <GlassCard key={r.id}>
              <div className="flex justify-between items-center mb-2">
                <SectionTitle>{new Date(r.date).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</SectionTitle>
                <div className="text-xs text-muted-foreground">{r.completed_count} done · {r.missed_count} missed</div>
              </div>
              <p className="text-sm text-muted-foreground">{r.summary}</p>
              {Array.isArray((r.suggestions as any)?.suggestions) && (
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Suggestions</div>
                  <ul className="text-sm space-y-1">{(r.suggestions as any).suggestions.map((s: string) => <li key={s}>• {s}</li>)}</ul>
                </div>
              )}
              {Array.isArray((r.suggestions as any)?.tomorrow_priorities) && (r.suggestions as any).tomorrow_priorities.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Tomorrow's priorities</div>
                  <ul className="text-sm space-y-1">{(r.suggestions as any).tomorrow_priorities.map((s: string) => <li key={s}>• {s}</li>)}</ul>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}