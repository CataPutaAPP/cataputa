import { VERSAO } from "@/lib/version";
import { useT, LanguageSwitcher } from "@/lib/i18n";
import { ThemeToggle } from "@/lib/theme";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { MapBackground } from "@/components/MapBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dashboardPath, useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Privora" },
      {
        name: "description",
        content: "Acesse sua conta Privora com usuário e senha.",
      },
      { property: "og:title", content: "Entrar — Privora" },
      { property: "og:description", content: "Login de clientes, prestadores e parceiros." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { signIn, requestPasswordReset } = useAuth();
  const { t } = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const { error, role } = await signIn(username, password);
    setLoading(false);
    if (error || !role) {
      toast.error(error ?? t("login.fail"));
      return;
    }
    toast.success(t("login.welcome"));
    navigate({ to: dashboardPath[role] });
  }

  async function handleReset() {
    if (!username.trim()) {
      toast.error(t("login.needuser"));
      return;
    }
    const { error } = await requestPasswordReset(username);
    if (error) toast.error(error);
    else toast.success(t("login.resetsent"));
  }

  return (
    <main className="relative min-h-dvh overflow-hidden px-5 py-8">
      <MapBackground className="opacity-60" />

      <div className="relative z-10 mx-auto w-full max-w-md">
        <div className="mb-10 flex items-center justify-between">
          <Button asChild variant="ghost" size="icon">
            <Link to="/">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <Logo size="sm" />
          <ThemeToggle />
          <LanguageSwitcher />
        </div>

        <form onSubmit={handleSubmit} className="panel space-y-4 p-6">
          <h1 className="text-2xl font-semibold">{t("login.title")}</h1>
          <div className="space-y-1.5">
            <Label htmlFor="username">{t("login.username")}</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("login.username.ph")}
              autoCapitalize="none"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("login.password")}</Label>
            <Input
              id="password"
              value={password}
              type="password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="h-12 w-full" disabled={loading}>
            {t("login.submit")}
          </Button>
          <button
            type="button"
            onClick={handleReset}
            className="w-full text-sm text-primary underline-offset-4 hover:underline"
          >
            {t("login.forgot")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("login.noaccount")}{" "}
          <Link to="/cadastro" className="text-primary hover:underline">
            {t("login.signup")}
          </Link>
        </p>
        <p className="mt-8 text-center text-[10px] text-muted-foreground/60">versão {VERSAO}</p>
      </div>
    </main>
  );
}
