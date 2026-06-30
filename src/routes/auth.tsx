import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Parallel Guardian AI" },
      { name: "description", content: "Sign in to your AI deadline guardian." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const signIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/dashboard", replace: true });
  };

  const signUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/dashboard" },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — signing you in…");
    const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
    if (e2) return toast.error(e2.message);
    navigate({ to: "/dashboard", replace: true });
  };

  const google = async () => {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) toast.error(res.error.message ?? "Google sign-in failed");
    if (!res.redirected && !res.error) navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10 grid-bg">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-strong rounded-2xl p-7 shadow-card"
      >
        <div className="flex items-center gap-2 mb-6">
          <div className="size-9 rounded-md bg-gradient-hot grid place-items-center shadow-glow">
            <Shield className="size-4 text-background" />
          </div>
          <div>
            <div className="font-display font-semibold tracking-tight">Parallel Guardian AI</div>
            <div className="text-xs text-muted-foreground">Your deadline rescue companion</div>
          </div>
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>
          <TabsContent value="signin" className="space-y-3 mt-4">
            <Field label="Email" value={email} onChange={setEmail} type="email" />
            <Field label="Password" value={password} onChange={setPassword} type="password" />
            <Button className="w-full bg-gradient-hot text-background hover:opacity-90" disabled={loading} onClick={signIn}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </TabsContent>
          <TabsContent value="signup" className="space-y-3 mt-4">
            <Field label="Email" value={email} onChange={setEmail} type="email" />
            <Field label="Password" value={password} onChange={setPassword} type="password" />
            <Button className="w-full bg-gradient-hot text-background hover:opacity-90" disabled={loading} onClick={signUp}>
              {loading ? "Creating…" : "Create account"}
            </Button>
          </TabsContent>
        </Tabs>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          OR
          <div className="h-px flex-1 bg-border" />
        </div>
        <Button variant="outline" className="w-full" onClick={google}>
          <GoogleIcon /> Continue with Google
        </Button>
        <p className="mt-6 text-xs text-center text-muted-foreground">
          Powered by Gemini · Built for students, professionals, and creators
        </p>
      </motion.div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-4 mr-2" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.5 6.1 28.9 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7C33.5 6.1 28.9 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c4.8 0 9.2-1.8 12.5-4.8l-5.8-4.9c-2 1.4-4.5 2.2-6.7 2.2-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.6 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l5.8 4.9C40.9 35.7 44 30.3 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>
  );
}