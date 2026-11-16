import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, FileCheck2, Loader2, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SecureImg } from "@/lib/media";
import { supabase } from "@/lib/supabase";

/**
 * Equipe da clínica: quem está disponível para atender, com foto.
 * Cada pessoa só aparece para clientes depois que o admin confere o documento (maior de 18).
 * A chave "Disponível" é o que a clínica liga e desliga no dia a dia.
 */
interface Staff {
  id: string; name: string; bio: string | null; photo_url: string; has_doc: boolean;
  is_active: boolean; approved: boolean; rejected_reason: string | null;
}
const vazio = { id: "", name: "", bio: "", photo_url: "", doc_path: "", temDoc: false };

export function PartnerStaff({ userId }: { userId: string }) {
  const [lista, setLista] = useState<Staff[] | null>(null);
  const [form, setForm] = useState<typeof vazio | null>(null);
  const [enviando, setEnviando] = useState<"foto" | "doc" | null>(null);
  const [salvando, setSalvando] = useState(false);
  const fotoRef = useRef<HTMLInputElement | null>(null);
  const docRef = useRef<HTMLInputElement | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from("partner_staff")
      .select("id, name, bio, photo_url, has_doc, is_active, approved, rejected_reason")
      .eq("partner_id", userId).order("created_at");
    setLista(error ? [] : ((data as Staff[]) ?? []));
  }, [userId]);
  useEffect(() => { carregar(); }, [carregar]);

  async function subirFoto(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Apenas imagens.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Máximo 5MB por foto.");
    setEnviando("foto");
    const path = `${userId}/staff/${Date.now()}.${file.name.split(".").pop() || "jpg"}`;
    const { error } = await supabase.storage.from("photos").upload(path, file, { upsert: false });
    setEnviando(null);
    if (error) return toast.error(`Erro no envio: ${error.message}`);
    const { data: { publicUrl } } = supabase.storage.from("photos").getPublicUrl(path);
    setForm((f) => (f ? { ...f, photo_url: publicUrl } : f));
  }
  async function subirDoc(file: File) {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") return toast.error("Envie foto ou PDF do documento.");
    if (file.size > 8 * 1024 * 1024) return toast.error("Máximo 8MB.");
    setEnviando("doc");
    const path = `${userId}/${Date.now()}.${file.name.split(".").pop() || "jpg"}`;
    const { error } = await supabase.storage.from("staff-docs").upload(path, file, { upsert: false });
    setEnviando(null);
    if (error) return toast.error(`Erro no envio: ${error.message}`);
    setForm((f) => (f ? { ...f, doc_path: path } : f));
  }

  async function salvar() {
    if (!form) return;
    if (!form.name.trim()) return toast.error("Informe o nome de atendimento.");
    if (!form.photo_url) return toast.error("Adicione uma foto.");
    if (!form.id && !form.doc_path) return toast.error("Envie o documento que comprova a maioridade.");
    setSalvando(true);
    const { error } = await supabase.rpc("save_partner_staff", {
      p_id: form.id || null, p_name: form.name.trim(), p_bio: form.bio.trim() || null,
      p_photo_url: form.photo_url, p_doc_path: form.doc_path || null, p_active: null,
    });
    setSalvando(false);
    if (error) return toast.error(error.message || "Não foi possível salvar.");
    toast.success(form.id ? "Cadastro atualizado." : "Enviado para análise. Aparece para os clientes assim que for aprovado.");
    setForm(null); carregar();
  }
  async function alternar(s: Staff) {
    setLista((l) => l?.map((x) => (x.id === s.id ? { ...x, is_active: !s.is_active } : x)) ?? l);
    const { error } = await supabase.rpc("save_partner_staff", {
      p_id: s.id, p_name: s.name, p_bio: s.bio, p_photo_url: null, p_doc_path: null, p_active: !s.is_active,
    });
    if (error) { toast.error(error.message); carregar(); }
  }
  async function apagar(s: Staff) {
    if (!confirm(`Remover ${s.name} da equipe?`)) return;
    const { error } = await supabase.rpc("delete_partner_staff", { p_id: s.id });
    if (error) return toast.error(error.message);
    carregar();
  }

  if (!lista) return <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  if (form) return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{form.id ? "Editar cadastro" : "Nova pessoa na equipe"}</h3>
        <Button variant="ghost" size="icon" onClick={() => setForm(null)} aria-label="Fechar"><X className="size-5" /></Button>
      </div>

      <div className="flex gap-4">
        <button onClick={() => fotoRef.current?.click()} aria-label="Escolher foto"
          className="relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-secondary/40">
          {enviando === "foto" ? <Loader2 className="size-6 animate-spin text-primary" />
            : form.photo_url ? <SecureImg src={form.photo_url} className="size-full object-cover" />
            : <span className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground"><Camera className="size-6" />Foto</span>}
        </button>
        <input ref={fotoRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) subirFoto(f); }} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-semibold">Nome de atendimento</p>
          <Input value={form.name} maxLength={40} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Como o cliente vai ver" />
          <p className="text-[11px] text-muted-foreground">Trocar a foto manda o cadastro de volta para análise.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Apresentação <span className="font-normal text-muted-foreground">(opcional)</span></p>
        <Textarea rows={2} maxLength={200} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
          placeholder="Especialidades, técnicas de massagem, idiomas..." />
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Documento com foto (maior de 18)</p>
        <button onClick={() => docRef.current?.click()}
          className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm ${form.doc_path || form.temDoc ? "border-green-500/30 bg-green-500/5" : "border-dashed border-border"}`}>
          {enviando === "doc" ? <Loader2 className="size-5 animate-spin text-primary" /> : <FileCheck2 className={`size-5 ${form.doc_path || form.temDoc ? "text-green-400" : "text-muted-foreground"}`} />}
          <span className="flex-1">
            {form.doc_path ? "Documento anexado" : form.temDoc ? "Documento já enviado · toque para trocar" : "Enviar RG ou CNH (foto ou PDF)"}
          </span>
        </button>
        <input ref={docRef} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) subirDoc(f); }} />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Só a equipe da Privora vê o documento, para confirmar a maioridade. Ele nunca aparece para clientes.
        </p>
      </div>

      <Button className="h-12 w-full" disabled={salvando || enviando !== null} onClick={salvar}>
        {salvando && <Loader2 className="mr-2 size-4 animate-spin" />} {form.id ? "Salvar" : "Enviar para análise"}
      </Button>
    </div>
  );

  const disponiveis = lista.filter((s) => s.approved && s.is_active).length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">
          <b className="text-green-400">{disponiveis}</b> <span className="text-muted-foreground">disponível(is) agora para os clientes</span>
        </p>
        <Button size="sm" onClick={() => setForm({ ...vazio })}><Plus className="mr-1 size-4" />Adicionar</Button>
      </div>

      {lista.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Users className="size-12 text-muted-foreground/30" />
          <p className="max-w-xs text-sm text-muted-foreground">
            Cadastre quem atende na clínica, com foto. O cliente escolhe a pessoa e pede o horário.
          </p>
        </div>
      )}

      {lista.map((s) => (
        <article key={s.id} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
          <SecureImg src={s.photo_url} className={`size-20 shrink-0 rounded-xl object-cover ${s.approved && s.is_active ? "" : "opacity-50"}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-semibold">{s.name}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                s.approved ? "bg-green-500/20 text-green-400" : s.rejected_reason ? "bg-destructive/20 text-destructive" : "bg-yellow-500/20 text-yellow-400"}`}>
                {s.approved ? "Aprovada" : s.rejected_reason ? "Recusada" : "Em análise"}
              </span>
            </div>
            {s.rejected_reason && <p className="mt-0.5 text-[11px] text-destructive">{s.rejected_reason}</p>}
            {!s.rejected_reason && s.bio && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{s.bio}</p>}
            <div className="mt-2 flex items-center gap-1.5">
              <button onClick={() => alternar(s)} disabled={!s.approved} aria-pressed={s.is_active}
                className={`flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium disabled:opacity-40 ${s.is_active && s.approved ? "border-green-500/40 bg-green-500/10 text-green-400" : "border-border text-muted-foreground"}`}>
                <span className={`size-2 rounded-full ${s.is_active && s.approved ? "bg-green-400" : "bg-muted-foreground"}`} />
                {s.is_active ? "Disponível" : "Indisponível"}
              </button>
              <Button size="sm" variant="ghost" className="h-8 px-2" aria-label="Editar"
                onClick={() => setForm({ id: s.id, name: s.name, bio: s.bio ?? "", photo_url: s.photo_url, doc_path: "", temDoc: s.has_doc })}>
                <Pencil className="size-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive" aria-label="Remover" onClick={() => apagar(s)}>
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
