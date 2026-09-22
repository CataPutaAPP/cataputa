import { type ReactNode } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { LogOut, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { HelpButton } from "@/components/HelpButton";
import { PlansButton } from "@/components/PlansButton";
import { VerificationGate } from "@/components/VerificationGate";
import { ChatNotifier } from "@/components/ChatNotifier";
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

  // TODO: Reativar guard quando Supabase estiver conectado
  // useEffect(() => {
  //   if (!loading && !user) navigate({ to: "/login", replace: true });
  // }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md">
        <Logo size="sm" />
        <div className="flex items-center gap-2">
          <Badge className="bg-accent text-accent-foreground">{roleLabel[role]}</Badge>
          {plan?.is_admin && (
            <Link to="/admin" aria-label="Administração"
              className="flex size-9 items-center justify-center rounded-md hover:bg-secondary">
              <ShieldCheck className="size-5 text-primary" />
            </Link>
          )}
          {user && <PlansButton audience={role} />}
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
      {user ? <VerificationGate>{children}</VerificationGate> : children}
    </div>
  );
}
