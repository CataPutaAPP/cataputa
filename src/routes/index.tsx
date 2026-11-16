import { LiveStats } from "@/components/LiveStats";
import { VERSAO } from "@/lib/version";
import { useT, LanguageSwitcher } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MapBackground } from "@/components/MapBackground";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Privora Private Club" },
      {
        name: "description",
        content:
          "Clube reservado para maiores de 18 anos. Perfis verificados, conversa protegida e total discrição.",
      },
      { property: "og:title", content: "Privora Private Club" },
      {
        property: "og:description",
        content: "Acesso reservado e verificado, com privacidade em primeiro lugar.",
      },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const { t } = useT();
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-between overflow-hidden px-6 pb-[calc(3.5rem+env(safe-area-inset-bottom))] pt-[calc(3.5rem+env(safe-area-inset-top))]">
      <MapBackground />
      <div className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] z-20"><LanguageSwitcher /></div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
        {/* véu atrás do texto: o mapa aparece em volta, sem atrapalhar a leitura */}
        <div className="flex flex-col items-center gap-8 rounded-[2rem] bg-background/70 px-5 py-8 backdrop-blur-[3px]">
        <Logo />
        <p className="max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
          {t("landing.tagline")}
        </p>
        </div>
      </div>

      <div className="relative z-10 mb-4 flex w-full justify-center"><LiveStats /></div>

      <div className="relative z-10 w-full max-w-sm space-y-3">
        <Button asChild size="lg" className="h-13 w-full text-base shadow-glow">
          <Link to="/cadastro">{t("landing.cta")}</Link>
        </Button>
        <Button asChild size="lg" variant="secondary" className="h-13 w-full text-base">
          <Link to="/login">{t("landing.member")}</Link>
        </Button>
        <p className="pt-2 text-center text-xs text-muted-foreground">
          {t("landing.legal")}{" "}
          <Link to="/termos" className="underline hover:text-primary">{t("landing.terms")}</Link> {t("landing.and")}{" "}
          <Link to="/privacidade" className="underline hover:text-primary">{t("landing.privacy")}</Link>.
          <span className="mt-2 block text-[10px] opacity-60">versão {VERSAO}</span>
        </p>
      </div>
    </main>
  );
}
