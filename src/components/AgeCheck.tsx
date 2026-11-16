import { useEffect, useRef, useState } from "react";
import { Camera, IdCard, Loader2, ScanFace, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { carregarEstimador, consolidar, lerRosto } from "@/lib/age-estimator";

const LEITURAS = 6;          // quantas leituras válidas formam o resultado
const TEMPO_MAX = 40000;     // desiste depois disso

/**
 * Selfie de idade: a câmera é analisada no próprio aparelho.
 * Resultado: "aprovado" (aparência de 25+) ou "documento" (precisa enviar foto com documento).
 */
export function AgeSelfie({ onDone, onClose }: { onDone: (r: "aprovado" | "documento") => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [fase, setFase] = useState<"preparando" | "lendo" | "enviando" | "erro">("preparando");
  const [dica, setDica] = useState("Carregando o verificador…");
  const [feitas, setFeitas] = useState(0);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    let fluxo: MediaStream | null = null;
    const parar = () => fluxo?.getTracks().forEach((t) => t.stop());
    const falhar = (m: string) => { if (vivo) { setErro(m); setFase("erro"); } parar(); };

    (async () => {
      try {
        setFase("preparando"); setFeitas(0); setDica("Carregando o verificador…");
        if (!navigator.mediaDevices?.getUserMedia) return falhar("Este navegador não libera a câmera. Use o Chrome ou o Safari atualizado.");
        const [faceapi, cam] = await Promise.all([
          carregarEstimador(),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }),
        ]);
        fluxo = cam;
        if (!vivo || !video.current) return parar();
        video.current.srcObject = cam;
        await video.current.play();
        setFase("lendo"); setDica("Olhe para a câmera, com o rosto bem iluminado.");

        const idades: number[] = [];
        const inicio = Date.now();
        while (vivo && idades.length < LEITURAS) {
          if (Date.now() - inicio > TEMPO_MAX) return falhar("Não conseguimos ver seu rosto. Procure um lugar mais claro, tire óculos escuros ou boné e tente de novo.");
          const l = await lerRosto(faceapi, video.current);
          if (!vivo) return parar();
          if (!l) setDica("Não estou vendo seu rosto. Centralize na tela.");
          else if (l.largura < 0.22) setDica("Chegue mais perto da câmera.");
          else { idades.push(l.idade); setFeitas(idades.length); setDica("Isso, fique assim…"); }
          await new Promise((r) => setTimeout(r, 350));
        }
        parar();
        if (!vivo) return;
        setFase("enviando");
        const { data, error } = await supabase.rpc("self_age_check", { p_age: Number(consolidar(idades).toFixed(1)), p_samples: idades.length });
        if (!vivo) return;
        if (error) return falhar(error.message || "Não foi possível registrar a verificação.");
        onDone((data as { result?: string })?.result === "aprovado" ? "aprovado" : "documento");
      } catch (e) {
        const nome = (e as { name?: string })?.name;
        falhar(nome === "NotAllowedError" ? "Você precisa permitir o uso da câmera para a verificação."
          : nome === "NotFoundError" ? "Nenhuma câmera encontrada neste aparelho."
          : (e as Error)?.message || "Não foi possível iniciar a verificação.");
      }
    })();
    return () => { vivo = false; parar(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentativa]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background/95 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 text-center">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 font-semibold"><ScanFace className="size-5 text-primary" />Verificação de idade</p>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar"><X className="size-5" /></Button>
        </div>

        <div className="relative mx-auto aspect-[3/4] w-full max-w-[260px] overflow-hidden rounded-[2rem] border-2 border-primary/40 bg-black">
          <video ref={video} playsInline muted className="size-full -scale-x-100 object-cover" />
          {fase !== "lendo" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              {fase === "erro" ? <Camera className="size-10 text-muted-foreground" /> : <Loader2 className="size-9 animate-spin text-primary" />}
            </div>
          )}
        </div>

        {fase === "erro" ? (
          <>
            <p className="mt-4 text-sm text-destructive">{erro}</p>
            <Button className="mt-4 h-11 w-full" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</Button>
          </>
        ) : (
          <>
            <p className="mt-4 min-h-10 text-sm">{fase === "enviando" ? "Conferindo…" : dica}</p>
            <div className="mx-auto mt-2 flex w-40 gap-1.5" aria-label={`${feitas} de ${LEITURAS} leituras`}>
              {Array.from({ length: LEITURAS }, (_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i < feitas ? "bg-primary" : "bg-secondary"}`} />
              ))}
            </div>
          </>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          A imagem é analisada só neste aparelho. Nenhuma foto é enviada ou guardada.
        </p>
      </div>
    </div>
  );
}

/** Foto com documento, enviada para conferência da equipe. A foto é apagada depois da decisão. */
export function AgeDocument({ userId, onSent }: { userId: string; onSent: () => void }) {
  const campo = useRef<HTMLInputElement | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Envie uma foto.");
    if (file.size > 10 * 1024 * 1024) return toast.error("Foto muito grande (máximo 10 MB).");
    setEnviando(true);
    const path = `${userId}/${Date.now()}.${(file.name.split(".").pop() || "jpg").toLowerCase()}`;
    const up = await supabase.storage.from("id-docs").upload(path, file, { upsert: false });
    if (up.error) { setEnviando(false); return toast.error(`Erro no envio: ${up.error.message}`); }
    const { error } = await supabase.rpc("submit_age_document", { p_path: path });
    setEnviando(false);
    if (error) return toast.error(error.message || "Não foi possível enviar.");
    toast.success("Recebido. Você é liberado assim que a conferência terminar.");
    onSent();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4 text-left">
      <p className="flex items-center gap-2 text-sm font-semibold"><IdCard className="size-4 text-primary" />Foto com documento</p>
      <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
        <li>Segure seu RG ou CNH aberto <b className="text-foreground">ao lado do rosto</b>.</li>
        <li>A foto e a data de nascimento do documento precisam estar legíveis.</li>
        <li>Lugar claro, sem óculos escuros ou boné.</li>
      </ol>
      <Button className="h-12 w-full text-base" disabled={enviando} onClick={() => campo.current?.click()}>
        {enviando ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Camera className="mr-2 size-5" />}
        {enviando ? "Enviando…" : "Tirar ou escolher a foto"}
      </Button>
      <input ref={campo} type="file" accept="image/*" capture="user" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) enviar(f); }} />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Só a equipe da Privora vê esta foto, apenas para confirmar que você tem 18 anos ou mais. Ela é apagada logo após a conferência.
      </p>
    </div>
  );
}
