import { useState, useEffect, useCallback, useRef } from "react";
import {
  X, Camera, Upload, Trash2, Star, MapPin, Shield, Eye,
  Loader2, ChevronLeft, ChevronRight, ImagePlus, Check,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { serviceFlags, getSubLabel, type ServiceType } from "@/lib/service-options";
import type { Profile } from "@/context/AuthContext";

/* ─── Types ─────────────────────────────────────────────────────────── */

interface ProviderPhoto {
  id: string;
  user_id: string;
  photo_url: string;
  sort_order: number;
  created_at: string;
}

interface ProviderProfileViewProps {
  providerId: string;
  onClose: () => void;
}

interface PhotoUploadProps {
  userId: string;
  onDone: () => void;
}

/* ─── Public: View a provider's profile (for clients) ──────────────── */

export function ProviderProfileView({ providerId, onClose }: ProviderProfileViewProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photos, setPhotos] = useState<ProviderPhoto[]>([]);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: prof }, { data: pics }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", providerId).single(),
        supabase.from("provider_photos").select("*").eq("user_id", providerId).order("sort_order"),
      ]);
      if (prof) setProfile(prof as Profile);
      if (pics) setPhotos(pics as ProviderPhoto[]);
      setLoading(false);
    })();
  }, [providerId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) return null;

  const avatarUrl = profile.avatar_url
    ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_url).data.publicUrl
    : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm">
      <div className="mx-auto max-w-md pb-10">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-background/90 px-4 py-3 backdrop-blur-md">
          <h2 className="text-lg font-semibold">Perfil</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="size-5" /></Button>
        </div>

        {/* Photo gallery */}
        {photos.length > 0 ? (
          <div className="relative">
            <div className="aspect-[3/4] w-full overflow-hidden bg-secondary">
              <img
                src={photos[currentPhoto]?.photo_url}
                alt={`Foto ${currentPhoto + 1}`}
                className="size-full object-cover"
              />
            </div>
            {photos.length > 1 && (
              <>
                <button onClick={() => setCurrentPhoto((p) => (p - 1 + photos.length) % photos.length)}
                  className="absolute left-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
                  <ChevronLeft className="size-5" />
                </button>
                <button onClick={() => setCurrentPhoto((p) => (p + 1) % photos.length)}
                  className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
                  <ChevronRight className="size-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {photos.map((_, i) => (
                    <button key={i} onClick={() => setCurrentPhoto(i)}
                      className={`size-2 rounded-full transition-all ${i === currentPhoto ? "bg-white scale-125" : "bg-white/40"}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : avatarUrl ? (
          <div className="aspect-square w-full overflow-hidden bg-secondary">
            <img src={avatarUrl} alt="Avatar" className="size-full object-cover" />
          </div>
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-secondary">
            <Camera className="size-16 text-muted-foreground/30" />
          </div>
        )}

        {/* Info card */}
        <div className="px-4 pt-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">{profile.full_name}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{profile.gender}</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-3 py-1.5">
                <Star className="size-4 fill-yellow-500 text-yellow-500" />
                <span className="text-sm font-semibold text-yellow-500">
                  {Number(profile.rating_avg).toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground">({profile.rating_count})</span>
              </div>
            </div>

            {profile.bio && (
              <p className="mt-3 text-sm text-muted-foreground">{profile.bio}</p>
            )}

            {profile.has_local && (
              <div className="mt-3 flex items-center gap-2 text-sm text-primary">
                <MapPin className="size-4" />
                <span>Tem local próprio</span>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="size-3.5" />
              <span>Verificado · Desde {new Date(profile.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Provider: Photo management (upload/delete) ───────────────────── */

export function PhotoManager({ userId, onDone }: PhotoUploadProps) {
  const [photos, setPhotos] = useState<ProviderPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchPhotos = useCallback(async () => {
    const { data } = await supabase
      .from("provider_photos")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order");
    if (data) setPhotos(data as ProviderPhoto[]);
  }, [userId]);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (photos.length + files.length > 5) {
      toast.error("Máximo de 5 fotos.");
      return;
    }

    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) { toast.error("Apenas imagens."); continue; }
      if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB por foto."); continue; }

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}_${i}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(path, file, { upsert: false });

      if (uploadError) {
        toast.error(`Erro no upload: ${uploadError.message}`);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage.from("photos").getPublicUrl(path);

      await supabase.from("provider_photos").insert({
        user_id: userId,
        photo_url: publicUrl,
        storage_path: path,
        sort_order: photos.length + i,
      });
    }
    setUploading(false);
    fetchPhotos();
    toast.success("Fotos enviadas!");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleDelete(photo: ProviderPhoto) {
    setDeleting(photo.id);
    // Delete from storage
    const storagePath = photo.photo_url.split("/photos/")[1];
    if (storagePath) {
      await supabase.storage.from("photos").remove([decodeURIComponent(storagePath)]);
    }
    // Delete from DB
    await supabase.from("provider_photos").delete().eq("id", photo.id);
    setDeleting(null);
    fetchPhotos();
    toast.success("Foto removida.");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Minhas fotos</h3>
          <p className="text-xs text-muted-foreground">{photos.length}/5 fotos · Mínimo 3 recomendado</p>
        </div>
        {photos.length < 5 && (
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <ImagePlus className="mr-1.5 size-3.5" />}
            {uploading ? "Enviando..." : "Adicionar"}
          </Button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />

      {photos.length === 0 ? (
        <button onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5">
          <Camera className="size-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">Adicione suas fotos</p>
            <p className="mt-1 text-xs text-muted-foreground">3 a 5 fotos de corpo inteiro para aparecer nas propostas</p>
          </div>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-[3/4] overflow-hidden rounded-xl bg-secondary">
              <img src={photo.photo_url} alt="Foto" className="size-full object-cover" />
              <button
                onClick={() => handleDelete(photo)}
                disabled={deleting === photo.id}
                className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 active:opacity-100">
                {deleting === photo.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              </button>
            </div>
          ))}
          {photos.length < 5 && (
            <button onClick={() => fileRef.current?.click()}
              className="flex aspect-[3/4] items-center justify-center rounded-xl border-2 border-dashed border-border transition-colors hover:border-primary/50">
              <ImagePlus className="size-6 text-muted-foreground/40" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Mini photo strip for proposal cards ──────────────────────────── */

export function ProviderPhotoStrip({ providerId, onClick }: { providerId: string; onClick?: () => void }) {
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("provider_photos")
        .select("url")
        .eq("user_id", providerId)
        .order("sort_order")
        .limit(3);
      if (data) setPhotos(data.map((p) => p.photo_url));
    })();
  }, [providerId]);

  if (photos.length === 0) return null;

  return (
    <button onClick={onClick} className="mt-2 flex gap-1.5">
      {photos.map((url, i) => (
        <div key={i} className="size-14 overflow-hidden rounded-lg bg-secondary">
          <img src={url} alt="" className="size-full object-cover" />
        </div>
      ))}
      {photos.length > 0 && (
        <div className="flex size-14 items-center justify-center rounded-lg border border-border text-xs text-muted-foreground">
          <Eye className="size-4" />
        </div>
      )}
    </button>
  );
}
