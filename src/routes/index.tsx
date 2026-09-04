import { createFileRoute, Link } from "@tanstack/react-router";
import { MapBackground } from "@/components/MapBackground";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ServiHub — Serviços sob demanda perto de você" },
      {
        name: "description",
        content:
          "Cadastre-se como cliente, prestador ou parceiro e comece a negociar serviços em minutos.",
      },
      { property: "og:title", content: "ServiHub — Serviços sob demanda" },
      {
        property: "og:description",
        content: "Cliente, prestador ou parceiro: escolha seu perfil e comece agora.",
      },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden px-6 py-14">
      <MapBackground />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-10">
        <Logo />
        <p className="max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
          Solicite serviços, receba ofertas em tempo real e conte com parceiros para
          entregar mais rápido.
        </p>
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-3">
        <Button asChild size="lg" className="h-13 w-full text-base shadow-glow">
          <Link to="/cadastro">Cadastro</Link>
        </Button>
        <Button asChild size="lg" variant="secondary" className="h-13 w-full text-base">
          <Link to="/login">Login</Link>
        </Button>
        <p className="pt-2 text-center text-xs text-muted-foreground">
          Ao continuar você aceita os termos de uso do ServiHub.
        </p>
      </div>
    </main>
  );
}
