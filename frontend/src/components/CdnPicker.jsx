/**
 * CdnPicker — modal to pick an already-uploaded Bunny CDN file.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   const [url, setUrl] = useState("");
 *   <CdnPicker open={open} onClose={() => setOpen(false)} kind="image" onPick={(f) => setUrl(f.url)} />
 *
 * `kind` is "image" | "audio" | "hls" | "all".
 */
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Search, FileAudio, FileImage, Music, Check, FolderOpen, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const KIND_LABELS = {
  image: { title: "Pick Image from CDN", icon: FileImage, color: "text-emerald-400" },
  audio: { title: "Pick Audio from CDN", icon: FileAudio, color: "text-rose-400" },
  hls: { title: "Pick HLS Stream from CDN", icon: Music, color: "text-violet-400" },
  all: { title: "Browse CDN", icon: FolderOpen, color: "text-blue-400" },
};

const formatSize = (bytes) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export default function CdnPicker({ open, onClose, kind = "image", onPick }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const meta = KIND_LABELS[kind] || KIND_LABELS.all;
  const Icon = meta.icon;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected(null);
    axios
      .get(`${API}/admin/cdn/browse/files?kind=${kind}`, { withCredentials: true })
      .then((r) => setFiles(r.data?.files || []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [open, kind]);

  const filtered = useMemo(() => {
    if (!search.trim()) return files;
    const q = search.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q) || (f.folder || "").includes(q));
  }, [files, search]);

  const confirm = () => {
    if (!selected) return;
    onPick?.(selected);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-4xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Icon size={18} className={meta.color} /> {meta.title}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Browse files already uploaded to Bunny CDN. Pick one to use instead of re-uploading.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-3">
          <Search size={16} className="text-zinc-500" />
          <Input
            placeholder="Search by filename or folder..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-zinc-950 border-zinc-800 text-white"
            data-testid="cdn-picker-search"
          />
          <Badge variant="outline" className="border-zinc-700 text-zinc-400">
            {filtered.length} / {files.length}
          </Badge>
        </div>

        <div className="overflow-y-auto flex-1 min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 size={28} className="text-violet-500 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-zinc-500 py-16">
              <Icon size={36} className="mx-auto text-zinc-700 mb-3" />
              <p>No files found</p>
            </div>
          ) : kind === "image" ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {filtered.map((f) => (
                <button
                  key={f.url}
                  type="button"
                  onClick={() => setSelected(f)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    selected?.url === f.url
                      ? "border-violet-500 ring-2 ring-violet-500/40"
                      : "border-zinc-800 hover:border-zinc-600"
                  }`}
                  data-testid="cdn-image-tile"
                >
                  <img src={f.url} alt={f.name} loading="lazy" className="w-full h-full object-cover" />
                  {selected?.url === f.url && (
                    <div className="absolute inset-0 bg-violet-600/30 flex items-center justify-center">
                      <Check size={28} className="text-white drop-shadow-lg" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                    <p className="text-[10px] text-white truncate">{f.name}</p>
                    <p className="text-[9px] text-zinc-400">{f.folder} • {formatSize(f.size)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            // Audio / HLS — list view with audio preview
            <ul className="space-y-1">
              {filtered.map((f) => (
                <li
                  key={f.url}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                    selected?.url === f.url
                      ? "bg-violet-900/30 border-violet-700"
                      : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"
                  }`}
                  onClick={() => setSelected(f)}
                  data-testid="cdn-audio-row"
                >
                  <div className={`w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center ${meta.color}`}>
                    {f.kind === "hls" ? <Music size={18} /> : <FileAudio size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{f.name}</p>
                    <p className="text-xs text-zinc-500">
                      {f.folder} • {formatSize(f.size)}
                    </p>
                  </div>
                  {f.kind === "audio" && (
                    <audio src={f.url} controls preload="none" className="h-8 max-w-[200px]" />
                  )}
                  {selected?.url === f.url && <Check size={18} className="text-violet-400" />}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-zinc-800 mt-3">
          <div className="text-xs text-zinc-500 truncate flex-1 mr-3">
            {selected ? (
              <>Selected: <span className="text-white">{selected.name}</span></>
            ) : (
              "Nothing selected"
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onClose?.()} className="border-zinc-700">
              Cancel
            </Button>
            <Button
              onClick={confirm}
              disabled={!selected}
              className="bg-violet-600 hover:bg-violet-700"
              data-testid="cdn-picker-confirm"
            >
              Use this file
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
