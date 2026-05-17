/**
 * CdnPicker — modal to pick an already-uploaded Bunny CDN file,
 * with bulk upload + inline rename support.
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   kind: "image" | "audio" | "hls" | "all"
 *   onPick: (file) => void
 */
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Search, FileAudio, FileImage, Music, Check, FolderOpen, Loader2,
  Upload, X, Edit2, Save, Plus,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const KIND_LABELS = {
  image: { title: "Pick Image from CDN", icon: FileImage, color: "text-emerald-400", accept: "image/*" },
  audio: { title: "Pick Audio from CDN", icon: FileAudio, color: "text-rose-400",    accept: "audio/*" },
  hls:   { title: "Pick HLS Stream",     icon: Music,     color: "text-violet-400",  accept: "" },
  all:   { title: "Browse CDN",          icon: FolderOpen, color: "text-blue-400",   accept: "image/*,audio/*" },
};

const formatSize = (b) => {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const niceName = (f) =>
  f.display_name && f.display_name !== f.name ? f.display_name : f.name;

export default function CdnPicker({ open, onClose, kind = "image", onPick }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  // Inline rename
  const [renamingUrl, setRenamingUrl] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");

  // Bulk upload
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const meta = KIND_LABELS[kind] || KIND_LABELS.all;
  const Icon = meta.icon;

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/cdn/browse/files?kind=${kind}`, { withCredentials: true });
      setFiles(r.data?.files || []);
    } catch (e) {
      console.error(e);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setRenamingUrl(null);
    setUploadOpen(false);
    setPendingFiles([]);
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind]);

  const filtered = useMemo(() => {
    if (!search.trim()) return files;
    const q = search.toLowerCase();
    return files.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.display_name || "").toLowerCase().includes(q) ||
        (f.folder || "").includes(q)
    );
  }, [files, search]);

  const confirm = () => {
    if (!selected) return;
    onPick?.(selected);
    onClose?.();
  };

  // --- Rename handlers ---
  const startRename = (f, e) => {
    e?.stopPropagation();
    setRenamingUrl(f.url);
    setRenameDraft(niceName(f));
  };
  const saveRename = async () => {
    if (!renamingUrl || !renameDraft.trim()) return setRenamingUrl(null);
    try {
      await axios.put(
        `${API}/admin/cdn/browse/files/rename`,
        { cdn_url: renamingUrl, display_name: renameDraft.trim() },
        { withCredentials: true }
      );
      setFiles((prev) =>
        prev.map((f) => (f.url === renamingUrl ? { ...f, display_name: renameDraft.trim() } : f))
      );
      toast.success("Renamed");
    } catch (e) {
      toast.error("Rename failed");
    } finally {
      setRenamingUrl(null);
    }
  };

  // --- Bulk upload handlers ---
  const onPickFiles = (e) => {
    const list = Array.from(e.target.files || []);
    if (list.length) setPendingFiles((prev) => [...prev, ...list]);
    e.target.value = "";
  };
  const removePending = (idx) => setPendingFiles((prev) => prev.filter((_, i) => i !== idx));

  const doBulkUpload = async () => {
    if (!pendingFiles.length) return;
    setUploading(true);
    setUploadProgress(0);
    const fd = new FormData();
    pendingFiles.forEach((f) => fd.append("files", f));
    fd.append("kind", kind === "image" ? "image" : kind === "audio" ? "audio" : "image");
    fd.append("keep_original_name", "true");
    try {
      const r = await axios.post(`${API}/admin/cdn/browse/bulk-upload`, fd, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (p) => setUploadProgress(Math.round((p.loaded / (p.total || 1)) * 100)),
      });
      const okN = r.data?.total_uploaded || 0;
      const failN = r.data?.total_failed || 0;
      if (okN) toast.success(`Uploaded ${okN} file${okN > 1 ? "s" : ""}`);
      if (failN) toast.error(`${failN} failed`);
      setPendingFiles([]);
      setUploadOpen(false);
      await fetchFiles();
    } catch (e) {
      console.error(e);
      toast.error("Bulk upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Icon size={18} className={meta.color} /> {meta.title}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Pick an existing file or upload more in bulk. Original filenames are preserved so the
            admin can recognise songs/images later.
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Search size={16} className="text-zinc-500" />
          <Input
            placeholder="Search by name or folder..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-zinc-950 border-zinc-800 text-white flex-1 min-w-[200px]"
            data-testid="cdn-picker-search"
          />
          <Badge variant="outline" className="border-zinc-700 text-zinc-400">
            {filtered.length} / {files.length}
          </Badge>
          {kind !== "hls" && (
            <Button
              size="sm"
              onClick={() => setUploadOpen((v) => !v)}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="cdn-picker-bulk-upload-toggle"
            >
              <Upload size={14} className="mr-1" /> Bulk Upload
            </Button>
          )}
        </div>

        {/* Bulk upload panel */}
        {uploadOpen && (
          <div className="mb-3 p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="border-zinc-700"
                data-testid="cdn-picker-choose-files"
              >
                <Plus size={14} className="mr-1" /> Add files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={meta.accept}
                onChange={onPickFiles}
                className="hidden"
              />
              <span className="text-xs text-zinc-500">
                {pendingFiles.length} file{pendingFiles.length === 1 ? "" : "s"} ready
              </span>
              <div className="flex-1" />
              {pendingFiles.length > 0 && (
                <Button
                  size="sm"
                  onClick={doBulkUpload}
                  disabled={uploading}
                  className="bg-violet-600 hover:bg-violet-700"
                  data-testid="cdn-picker-start-upload"
                >
                  {uploading ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Upload size={14} className="mr-1" />}
                  {uploading ? `Uploading ${uploadProgress}%` : "Start upload"}
                </Button>
              )}
            </div>
            {pendingFiles.length > 0 && (
              <ul className="max-h-40 overflow-y-auto space-y-1">
                {pendingFiles.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900 px-2 py-1 rounded">
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-zinc-500">{formatSize(f.size)}</span>
                    {!uploading && (
                      <button onClick={() => removePending(i)} className="text-zinc-500 hover:text-red-400">
                        <X size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {uploading && (
              <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
          </div>
        )}

        {/* File grid / list */}
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
              {filtered.map((f) => {
                const isSel = selected?.url === f.url;
                const isRenaming = renamingUrl === f.url;
                return (
                  <div
                    key={f.url}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all group ${
                      isSel ? "border-violet-500 ring-2 ring-violet-500/40" : "border-zinc-800 hover:border-zinc-600"
                    }`}
                    data-testid="cdn-image-tile"
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(f)}
                      className="absolute inset-0"
                      aria-label={`Pick ${niceName(f)}`}
                    >
                      <img src={f.url} alt={niceName(f)} loading="lazy" className="w-full h-full object-cover" />
                    </button>
                    {isSel && (
                      <div className="absolute inset-0 bg-violet-600/30 flex items-center justify-center pointer-events-none">
                        <Check size={28} className="text-white drop-shadow-lg" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-1.5">
                      {isRenaming ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Input
                            autoFocus
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveRename()}
                            className="h-6 text-[10px] bg-zinc-950 border-zinc-700"
                          />
                          <button onClick={saveRename} className="text-emerald-400 p-0.5">
                            <Save size={12} />
                          </button>
                          <button onClick={() => setRenamingUrl(null)} className="text-zinc-500 p-0.5">
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-[10px] text-white truncate font-medium">{niceName(f)}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] text-zinc-400">{f.folder} • {formatSize(f.size)}</p>
                            <button
                              onClick={(e) => startRename(f, e)}
                              className="text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100"
                              title="Rename"
                            >
                              <Edit2 size={11} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Audio / HLS list view
            <ul className="space-y-1">
              {filtered.map((f) => {
                const isSel = selected?.url === f.url;
                const isRenaming = renamingUrl === f.url;
                return (
                  <li
                    key={f.url}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                      isSel ? "bg-violet-900/30 border-violet-700" : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"
                    }`}
                    data-testid="cdn-audio-row"
                  >
                    <div
                      className={`w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center cursor-pointer ${meta.color}`}
                      onClick={() => setSelected(f)}
                    >
                      {f.kind === "hls" ? <Music size={18} /> : <FileAudio size={18} />}
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelected(f)}>
                      {isRenaming ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Input
                            autoFocus
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveRename()}
                            className="h-7 text-sm bg-zinc-950 border-zinc-700"
                          />
                          <button onClick={saveRename} className="text-emerald-400 p-1">
                            <Save size={14} />
                          </button>
                          <button onClick={() => setRenamingUrl(null)} className="text-zinc-500 p-1">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-white truncate font-medium">{niceName(f)}</p>
                          <p className="text-xs text-zinc-500">{f.folder} • {formatSize(f.size)}</p>
                        </>
                      )}
                    </div>
                    {f.kind === "audio" && !isRenaming && (
                      <audio src={f.url} controls preload="none" className="h-8 max-w-[200px]" />
                    )}
                    {!isRenaming && (
                      <button
                        onClick={(e) => startRename(f, e)}
                        className="text-zinc-500 hover:text-white"
                        title="Rename"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                    {isSel && !isRenaming && <Check size={18} className="text-violet-400" />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-zinc-800 mt-3">
          <div className="text-xs text-zinc-500 truncate flex-1 mr-3">
            {selected ? <>Selected: <span className="text-white">{niceName(selected)}</span></> : "Nothing selected"}
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
