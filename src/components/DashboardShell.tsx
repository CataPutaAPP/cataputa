import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { Logo } from "@/components/Logo";
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

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
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
        </div>
      </header>
      {children}
    </div>
  );
}
