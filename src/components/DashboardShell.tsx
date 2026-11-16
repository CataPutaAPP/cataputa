import { LanguageSwitcher } from "@/lib/i18n";
import { useEffect, type ReactNode } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { LogOut, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { HelpButton } from "@/components/HelpButton";
import { PlansButton } from "@/components/PlansButton";
import { VerificationGate } from "@/components/VerificationGate";
import { TermsGate } from "@/components/TermsGate";
import { ChatNotifier } from "@/components/ChatNotifier";
import { PreferencesButton } from "@/components/PreferencesButton";
import { useDiscreet, usePrivacyBlur } from "@/lib/discreet";
import { useMyPlan } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/types";

const roleLabel: Record<UserRole, string> = {
  cliente: "Cliente",
  prestador: "Prestador",
  parceiro: "Parceiro",
};

export function DashboardShell({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { plan } = useMyPlan(!!user);
  const discretoLiberado = Number(plan?.features?.["discreet_mode"] ?? 0) === 1;
  const { ligado: discreto } = useDiscreet(discretoLiberado);
  const telaOculta = usePrivacyBlur(discreto);

  // Guarda de acesso: sem login vai para /login; perfil errado volta para a própria área.
  // O admin (is_admin) pode abrir qualquer área para conferência.
  const outraArea = !!user && user.role !== role && plan !== null && !plan.is_admin;
  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login", replace: true }); return; }
    if (outraArea) navigate({ to: `/${user.role}` as "/cliente", replace: true });
  }, [loading, user, outraArea, navigate]);

  if (loading || !user || outraArea) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh">
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md sm:px-4"
        style={{ height: "var(--header-h)", paddingTop: "var(--safe-t)" }}>
        <Logo size="sm" />
        <div className="flex items-center gap-0.5 sm:gap-2">
          <Badge className="mr-1 hidden bg-accent text-accent-foreground sm:inline-flex">{roleLabel[role]}</Badge>
          {plan?.is_admin && (
            <Link to="/admin" aria-label="Administração"
              className="flex size-9 items-center justify-center rounded-md hover:bg-secondary">
              <ShieldCheck className="size-5 text-primary" />
            </Link>
          )}
          {user && <PlansButton audience={role} />}
          <LanguageSwitcher />
          <PreferencesButton />
          <HelpButton screen={role} />
          {user && <NotificationBell />}
          {user && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sair"
              onClick={() => {
                signOut();
                navigate({ to: "/", replace: true });
              }}
            >
              <LogOut className="size-5" />
            </Button>
          )}
        </div>
      </header>
      {user && <ChatNotifier userId={user.id} />}
      {telaOculta && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background"
             style={{ backdropFilter: "blur(24px)" }}>
          <p className="text-sm text-muted-foreground">Agenda</p>
        </div>
      )}
      <TermsGate><VerificationGate>{children}</VerificationGate></TermsGate>
    </div>
  );
}
