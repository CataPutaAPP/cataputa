import { useCallback, useEffect, useRef, useState } from "react";
import { Video, Upload, Loader2, Trash2, Clock, CheckCircle2, XCircle, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useMyPlan } from "@/lib/plans";

interface MyVideo { url: string; status: "em_revisao" | "aprovado" | "reprovado"; admin_note: string | null; enviado_em: string }

const MAX_MB = 25;

/** Vídeo de apresentação — recurso do plano Top. Passa por moderação antes de ficar público. */
export function ProviderVideoManager({ userId }: { userId: string }) {
  const { plan } = useMyPlan();
  const liberado = Number(plan?.features?.["presentation_video"] ?? 0) === 1;
  const [video, setVideo] = useState<MyVideo | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("my_provider_video");
    setVideo((data as MyVideo) ?? null);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function upload(file: File) {
    if (!file.type.startsWith("video/")) return toast.error("Envie um arquivo de vídeo.");
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`Máximo de ${MAX_MB} MB. Grave um vídeo mais curto.`);
    setBusy(true);
    const ext = file.name.split(".").pop() || "mp4";
    const path = `${userId}/apresentacao_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("videos").upload(path, file, { upsert: false });
    if (upErr) { setBusy(false); return toast.error(`Erro no envio: ${upErr.message}`); }
    const { data: { publicUrl } } = supabase.storage.from("videos").getPublicUrl(path);
    const { error } = await supabase.rpc("set_provider_video", { p_url: publicUrl, p_path: path });
    setBusy(false);
    if (error) { await supabase.storage.from("videos").remove([path]); return toast.error(error.message); }
    toast.success("Vídeo enviado! Ele aparece no seu perfil após a análise.");
    load();
  }

  async function remover() {
    setBusy(true);
    await supabase.rpc("delete_provider_video");
    setBusy(false); setVideo(null);
    toast.success("Vídeo removido.");
  }

  if (!liberado) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 font-semibold"><Video className="size-4" /> Vídeo de apresentação</p>
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
          <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>Um vídeo curto aumenta muito a confiança de quem procura. Faz parte do plano <b className="text-primary">Top</b>.</span>
        </div>
      </div>
    );
  }

  const selo = {
    em_revisao: { icon: <Clock className="size-3.5" />, txt: "Em análise — aparece no perfil após aprovação", cls: "text-yellow-400" },
    aprovado:   { icon: <CheckCircle2 className="size-3.5" />, txt: "Aprovado e visível no seu perfil", cls: "text-green-400" },
    reprovado:  { icon: <XCircle className="size-3.5" />, txt: "Reprovado", cls: "text-destructive" },
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 font-semibold"><Video className="size-4" /> Vídeo de apresentação</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Até {MAX_MB} MB. Fale seu nome e o que você oferece — sem nudez explícita.</p>

      <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />

      {video ? (
        <div className="mt-3 space-y-2">
          <video src={video.url} controls playsInline className="w-full rounded-xl bg-black" />
          <p className={`flex items-center gap-1.5 text-xs ${selo[video.status].cls}`}>
            {selo[video.status].icon}{selo[video.status].txt}
          </p>
          {video.status === "reprovado" && video.admin_note && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{video.admin_note}</p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />} Trocar vídeo
            </Button>
            <Button variant="ghost" className="text-destructive" disabled={busy} onClick={remover}><Trash2 className="size-4" /></Button>
          </div>
        </div>
      ) : (
        <Button className="mt-3 w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />} Enviar vídeo
        </Button>
      )}
    </div>
  );
}

/** Player do vídeo no perfil público (só aparece se aprovado). */
export function ProviderVideoPlayer({ providerId }: { providerId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.rpc("provider_video", { p_provider_id: providerId })
      .then(({ data }) => setUrl((data as { url: string } | null)?.url ?? null));
  }, [providerId]);
  if (!url) return null;
  return (
    <div className="mt-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Video className="size-4 text-primary" /> Apresentação</p>
      <video src={url} controls playsInline className="w-full rounded-xl bg-black" />
    </div>
  );
}
