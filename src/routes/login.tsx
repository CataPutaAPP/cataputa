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
      { title: "Entrar — ServiHub" },
      {
        name: "description",
        content: "Acesse sua conta ServiHub com username e senha e vá direto ao seu painel.",
      },
      { property: "og:title", content: "Entrar — ServiHub" },
      { property: "og:description", content: "Login de clientes, prestadores e parceiros." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { signIn, requestPasswordReset } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const { error, role } = await signIn(username, password);
    setLoading(false);
    if (error || !role) {
      toast.error(error ?? "Não foi possível entrar.");
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: dashboardPath[role] });
  }

  async function handleReset() {
    if (!username.trim()) {
      toast.error("Informe seu username primeiro.");
      return;
    }
    const { error } = await requestPasswordReset(username);
    if (error) toast.error(error);
    else toast.success("Enviamos um link de redefinição para o e-mail cadastrado.");
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-8">
      <MapBackground className="opacity-60" />

      <div className="relative z-10 mx-auto w-full max-w-md">
        <div className="mb-10 flex items-center justify-between">
          <Button asChild variant="ghost" size="icon">
            <Link to="/">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <Logo size="sm" />
          <span className="w-9" />
        </div>

        <form onSubmit={handleSubmit} className="panel space-y-4 p-6">
          <h1 className="text-2xl font-semibold">Entrar</h1>
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="seu.username"
              autoCapitalize="none"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              value={password}
              type="password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="h-12 w-full" disabled={loading}>
            Entrar
          </Button>
          <button
            type="button"
            onClick={handleReset}
            className="w-full text-sm text-primary underline-offset-4 hover:underline"
          >
            Esqueci minha senha
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link to="/cadastro" className="text-primary hover:underline">
            Cadastre-se
          </Link>
        </p>
      </div>
    </main>
  );
}
