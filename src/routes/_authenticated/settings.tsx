import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { GlassCard, SectionTitle } from "@/components/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User as UserIcon, Bell, Moon, Globe } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Parallel Guardian AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user?.id ?? "").maybeSingle();
      return { email: user?.email ?? "", profile };
    },
  });
  const [name, setName] = useState("");
  const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [notif, setNotif] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof document === "undefined") return true;
    return !document.documentElement.classList.contains("light");
  });
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("light", !darkMode);
    try { localStorage.setItem("pg-theme", darkMode ? "dark" : "light"); } catch {}
  }, [darkMode]);
  useEffect(() => {
    if (me?.profile) {
      setName(me.profile.display_name ?? "");
      setTz(me.profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [me]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update({ display_name: name, timezone: tz }).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Profile saved"),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
      <h1 className="text-3xl font-display font-semibold tracking-tight">Settings</h1>

      <GlassCard>
        <SectionTitle kicker="Account">Profile</SectionTitle>
        <div className="flex items-center gap-4 mb-4">
          <div className="size-14 rounded-full bg-gradient-hot grid place-items-center text-background"><UserIcon className="size-6" /></div>
          <div className="min-w-0">
            <div className="font-medium truncate">{name || "Unnamed"}</div>
            <div className="text-xs text-muted-foreground truncate">{me?.email}</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="name" className="text-xs uppercase tracking-wider text-muted-foreground">Display name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <Label htmlFor="tz" className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Globe className="size-3" /> Timezone</Label>
            <Input id="tz" value={tz} onChange={(e) => setTz(e.target.value)} placeholder="Region/City" />
          </div>
        </div>
        <Button className="mt-4" disabled={saveProfile.isPending} onClick={() => saveProfile.mutate()}>
          {saveProfile.isPending ? "Saving…" : "Save profile"}
        </Button>
      </GlassCard>

      <GlassCard>
        <SectionTitle kicker="Preferences">Notifications & appearance</SectionTitle>
        <div className="space-y-3">
          <Pref icon={Bell} label="Deadline & risk notifications" desc="Ping me when a task slips into high risk." checked={notif} onChange={setNotif} />
          <Pref icon={Moon} label="Dark mode" desc="Optimized for late-night focus sessions." checked={darkMode} onChange={setDarkMode} />
        </div>
      </GlassCard>

      <GlassCard>
        <SectionTitle>Account</SectionTitle>
        <Button variant="outline" onClick={signOut}>Sign out</Button>
      </GlassCard>
    </div>
  );
}

function Pref({ icon: Icon, label, desc, checked, onChange }: { icon: any; label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/5 p-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="size-8 rounded-md bg-white/5 grid place-items-center shrink-0"><Icon className="size-4 text-muted-foreground" /></div>
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}