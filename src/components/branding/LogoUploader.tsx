import { useRef, useState } from "react";
import { Upload, Image as ImageIcon, Trash2, Link as LinkIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ACCEPTED = ["image/png", "image/svg+xml", "image/jpeg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const BUCKET = "restaurant-assets";

type Props = {
  restaurantId: string;
  value: string;
  onChange: (url: string) => void;
};

export function LogoUploader({ restaurantId, value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Alleen PNG, SVG, JPEG of WebP");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Bestand is te groot (max 2 MB)");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${restaurantId}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
    if (upErr) {
      setUploading(false);
      toast.error("Upload mislukt: " + upErr.message);
      return;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    setUploading(false);
    onChange(data.publicUrl);
    toast.success("Logo geüpload");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4" /> Logo
      </Label>

      {value ? (
        <div className="flex items-center gap-4 rounded-md border border-border p-3">
          <div className="h-16 w-16 rounded-md bg-muted/40 flex items-center justify-center overflow-hidden">
            <img src={value} alt="Logo" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{value}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
            aria-label="Verwijder logo"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-dashed border-border bg-muted/20 hover:bg-muted/40 cursor-pointer p-6 text-center transition-colors"
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Uploaden…
            </div>
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">Klik of sleep een logo hierheen</p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, SVG, JPEG of WebP — max 2 MB
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {!showUrlInput ? (
        <button
          type="button"
          onClick={() => {
            setUrlDraft(value);
            setShowUrlInput(true);
          }}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <LinkIcon className="h-3 w-3" /> Of plak een URL
        </button>
      ) : (
        <div className="flex gap-2">
          <Input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="https://..."
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onChange(urlDraft.trim());
              setShowUrlInput(false);
            }}
          >
            Toepassen
          </Button>
        </div>
      )}
    </div>
  );
}
