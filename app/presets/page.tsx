"use client";

import { useState, useEffect, ChangeEvent } from "react";
import Link from "next/link";
import BookmarkIcon from "@heroicons/react/24/outline/BookmarkIcon";
import PlusIcon from "@heroicons/react/24/outline/PlusIcon";
import TrashIcon from "@heroicons/react/24/outline/TrashIcon";
import PencilSquareIcon from "@heroicons/react/24/outline/PencilSquareIcon";
import CheckIcon from "@heroicons/react/24/outline/CheckIcon";
import ExclamationCircleIcon from "@heroicons/react/24/outline/ExclamationCircleIcon";
import ArrowUpTrayIcon from "@heroicons/react/24/outline/ArrowUpTrayIcon";
import ArrowLeftIcon from "@heroicons/react/24/outline/ArrowLeftIcon";
import ArrowPathIcon from "@heroicons/react/24/outline/ArrowPathIcon";

import { Preset, PresetSettings } from "@/db/schema";
import {
  fetchPresets,
  createPreset,
  updatePreset,
  deletePreset,
} from "@/lib/api/client";
import { PresetEditorCanvas } from "@/components/PresetEditorCanvas";
import { ConfirmationModal } from "@/components/ConfirmationModal";

const ANCHOR_POSITIONS: Array<{
  id: PresetSettings["position"];
  label: string;
}> = [
  { id: "top-left", label: "Kiri Atas" },
  { id: "top-center", label: "Tengah Atas" },
  { id: "top-right", label: "Kanan Atas" },
  { id: "center-left", label: "Kiri Tengah" },
  { id: "center", label: "Tengah" },
  { id: "center-right", label: "Kanan Tengah" },
  { id: "bottom-left", label: "Kiri Bawah" },
  { id: "bottom-center", label: "Tengah Bawah" },
  { id: "bottom-right", label: "Kanan Bawah" },
];

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function PresetsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <ArrowPathIcon className="w-4 h-4 animate-spin text-primary" />
          <span>Memuat Preset...</span>
        </div>
      }
    >
      <PresetsContent />
    </Suspense>
  );
}

function PresetsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams?.get("returnTo") || null;
  const shouldAutoCreate = searchParams?.get("create") === "true";

  const [presets, setPresets] = useState<Preset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoWarning, setLogoWarning] = useState<string | null>(null);
  const [settings, setSettings] = useState<PresetSettings>({
    position: "bottom-right",
    opacityPct: 80,
    scalePct: 15,
    rotationDeg: 0,
    offsetX: 4,
    offsetY: 4,
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete modal state
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    presetId: string | null;
    presetName: string;
  }>({
    isOpen: false,
    presetId: null,
    presetName: "",
  });

  useEffect(() => {
    loadPresets().then(() => {
      if (shouldAutoCreate) {
        handleStartNew();
      }
    });
  }, [shouldAutoCreate]);

  const loadPresets = async () => {
    setIsLoading(true);
    try {
      const list = await fetchPresets();
      setPresets(list);
    } catch (err) {
      console.error("Gagal memuat preset:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNew = () => {
    setEditingId(null);
    setName("");
    setLogoUrl("");
    setLogoWarning(null);
    setSettings({
      position: "bottom-right",
      opacityPct: 80,
      scalePct: 15,
      rotationDeg: 0,
      offsetX: 4,
      offsetY: 4,
    });
    setFormError(null);
    setIsEditing(true);
  };

  const handleStartEdit = (preset: Preset) => {
    setEditingId(preset.id);
    setName(preset.name);
    setLogoUrl(preset.logoUrl);
    setLogoWarning(null);
    setSettings(preset.settings);
    setFormError(null);
    setIsEditing(true);
  };

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/webp", "image/svg+xml"].includes(file.type)) {
      setLogoWarning(
        "Catatan: Gunakan gambar PNG atau WebP berlatar transparan agar watermark tampil rapi."
      );
    } else {
      setLogoWarning(null);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === "string") {
        setLogoUrl(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Mohon masukkan nama preset (misal: 'Mawmaw Interior Utama').");
      return;
    }
    if (!logoUrl) {
      setFormError("Mohon upload file gambar logo watermark terlebih dahulu.");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      let savedPresetId = editingId;
      if (editingId) {
        await updatePreset(editingId, {
          name: name.trim(),
          logoUrl,
          settings,
        });
      } else {
        const created = await createPreset(name.trim(), logoUrl, settings);
        savedPresetId = created.id;
      }
      setIsEditing(false);
      await loadPresets();

      // If user came from Editor with returnTo parameter, redirect back automatically
      if (returnTo) {
        router.push(`${returnTo}?selectedPresetId=${savedPresetId}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan preset";
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (returnTo && !editingId) {
      router.push(returnTo);
    } else {
      setIsEditing(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModalState.presetId) return;
    try {
      await deletePreset(deleteModalState.presetId);
      await loadPresets();
    } catch (err) {
      console.error("Gagal menghapus preset:", err);
    } finally {
      setDeleteModalState({ isOpen: false, presetId: null, presetName: "" });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pb-28 sm:pb-32 flex flex-col gap-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-0.5">
            <Link href={returnTo || "/"} className="hover:text-foreground">
              {returnTo ? "← Kembali ke Editor" : "Koleksi Foto"}
            </Link>
            <span>/</span>
            <span>Preset</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Preset Watermark Klien
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
            Simpan template watermark untuk masing-masing klien agar bisa langsung dipasang saat proses foto.
          </p>
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={handleStartNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:bg-primary/90 transition-all shadow-sm active:scale-95"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Buat Preset Baru</span>
          </button>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PRESET EDITOR FORM & LIVE PREVIEW CANVAS */}
      {/* ------------------------------------------------------------- */}
      {isEditing && (
        <div className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-xl p-6 sm:p-8 shadow-sm flex flex-col gap-7 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-border/50 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shadow-inner">
                <BookmarkIcon className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground">
                  {editingId ? "Edit Preset Watermark" : "Preset Watermark Baru"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {returnTo
                    ? "Setelah disimpan, preset langsung aktif di Editor Foto."
                    : "Atur posisi, ukuran, dan transparansi logo agar proporsional."}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCancel}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground px-3.5 py-1.5 rounded-lg border border-border/60 hover:bg-muted transition-all active:scale-95"
            >
              <span>Batal</span>
            </button>
          </div>

          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8">
            {/* Live Interactive Canvas Preview (Top on Mobile, Right on Desktop) */}
            <div className="lg:col-span-5 lg:order-2 flex flex-col gap-2.5">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Pratinjau Langsung Watermark
              </span>
              <div className="rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 shadow-lg bg-black/5">
                <PresetEditorCanvas settings={settings} logoUrl={logoUrl} />
              </div>
            </div>

            {/* Form Controls (Bottom on Mobile, Left on Desktop) */}
            <form onSubmit={handleSave} className="lg:col-span-7 lg:order-1 flex flex-col gap-5">
              {/* Preset Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Nama Preset <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Mawmaw Interior Utama"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-medium focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                  required
                />
              </div>

              {/* Watermark Logo Upload */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-foreground">
                  File Logo Watermark <span className="text-destructive">*</span>
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="min-h-[44px] cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/60 bg-background text-xs font-semibold hover:bg-muted transition-all active:scale-95 shadow-sm">
                    <ArrowUpTrayIcon className="w-4 h-4 text-primary" />
                    <span>Pilih File Logo (PNG/SVG)</span>
                    <input
                      type="file"
                      accept=".png,.webp,.svg,image/png,image/webp,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="sr-only"
                    />
                  </label>
                  {logoUrl && (
                    <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1 min-h-[30px]">
                      <CheckIcon className="w-4 h-4" /> Logo Terpasang
                    </span>
                  )}
                </div>
                {logoWarning && (
                  <span className="text-[11px] text-amber-800 dark:text-amber-300">
                    {logoWarning}
                  </span>
                )}
              </div>

              {/* 9-Point Anchor Position Grid */}
              <div className="flex flex-col gap-2.5">
                <label className="text-xs font-semibold text-foreground">
                  Posisi Sudut Penempatan
                </label>
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5 max-w-sm">
                  {ANCHOR_POSITIONS.map((pos) => {
                    const isSelected = settings.position === pos.id;
                    return (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() =>
                          setSettings({ ...settings, position: pos.id })
                        }
                        className={`min-h-[44px] py-2.5 px-2 rounded-xl text-xs font-medium border text-center transition-all active:scale-95 ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary font-semibold shadow-sm"
                            : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted border-border/60"
                        }`}
                      >
                        {pos.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scale Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs min-h-[30px]">
                  <span className="font-semibold text-foreground">Ukuran Logo</span>
                  <span className="text-muted-foreground font-mono">
                    {settings.scalePct}% dari lebar foto
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={settings.scalePct}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      scalePct: parseInt(e.target.value),
                    })
                  }
                  className="w-full accent-primary min-h-[36px]"
                />
              </div>

              {/* Opacity Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs min-h-[30px]">
                  <span className="font-semibold text-foreground">Transparansi (Opacity)</span>
                  <span className="text-muted-foreground font-mono">
                    {settings.opacityPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={settings.opacityPct}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      opacityPct: parseInt(e.target.value),
                    })
                  }
                  className="w-full accent-primary min-h-[36px]"
                />
              </div>

              {/* Rotation Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs min-h-[30px]">
                  <span className="font-semibold text-foreground">Kemiringan (Rotasi)</span>
                  <span className="text-muted-foreground font-mono">
                    {settings.rotationDeg}°
                  </span>
                </div>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  value={settings.rotationDeg}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      rotationDeg: parseInt(e.target.value),
                    })
                  }
                  className="w-full accent-primary min-h-[36px]"
                />
              </div>

              {/* Error Display */}
              {formError && (
                <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                  <ExclamationCircleIcon className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-border/50">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="min-h-[44px] flex-1 sm:flex-none px-6 py-2.5 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50 active:scale-95"
                >
                  {isSaving ? "Menyimpan..." : editingId ? "Perbarui Preset" : "Simpan Preset"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="min-h-[44px] px-5 py-2.5 border border-border/60 bg-background text-xs font-semibold rounded-xl hover:bg-muted transition-all active:scale-95"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PRESETS LIST VIEW */}
      {/* ------------------------------------------------------------- */}
      {!isEditing && (
        <div className="flex flex-col gap-5">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <ArrowPathIcon className="w-4 h-4 animate-spin text-primary" />
              <span>Memuat daftar preset...</span>
            </div>
          ) : presets.length === 0 ? (
            <div className="p-12 rounded-3xl border border-dashed border-border/70 text-center flex flex-col items-center justify-center gap-3 text-muted-foreground bg-card/20">
              <BookmarkIcon className="w-10 h-10 opacity-30 text-muted-foreground" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-foreground">
                  Belum ada preset tersimpan
                </span>
                <span className="text-xs max-w-sm text-muted-foreground leading-relaxed">
                  Yuk buat template watermark untuk brand atau klien agar proses finishing foto makin cepat.
                </span>
              </div>
              <button
                type="button"
                onClick={handleStartNew}
                className="mt-3 px-5 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-sm active:scale-95"
              >
                Buat Preset Pertama
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="rounded-3xl border border-border/60 bg-card/80 backdrop-blur-sm p-6 flex flex-col justify-between gap-5 shadow-sm hover:border-primary/40 transition-all hover:scale-[1.01]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-muted border border-border/60 p-2 flex items-center justify-center shrink-0 shadow-inner">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={preset.logoUrl}
                          alt={preset.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex flex-col">
                        <h3 className="text-sm font-bold text-foreground leading-tight">
                          {preset.name}
                        </h3>
                        <span className="text-[11px] text-muted-foreground capitalize">
                          {preset.settings.position.replace("-", " ")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(preset)}
                        aria-label={`Edit ${preset.name}`}
                        className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-all border border-border/40 active:scale-90"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteModalState({
                            isOpen: true,
                            presetId: preset.id,
                            presetName: preset.name,
                          })
                        }
                        aria-label={`Hapus ${preset.name}`}
                        className="p-2 text-muted-foreground hover:text-destructive rounded-xl hover:bg-muted transition-all border border-border/40 active:scale-90"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-muted/40 text-[11px] text-muted-foreground border border-border/40">
                    <div>
                      <span className="block text-[10px] uppercase font-semibold">Ukuran</span>
                      <span className="font-bold text-foreground font-mono">{preset.settings.scalePct}%</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-semibold">Transparansi</span>
                      <span className="font-bold text-foreground font-mono">{preset.settings.opacityPct}%</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-semibold">Rotasi</span>
                      <span className="font-bold text-foreground font-mono">{preset.settings.rotationDeg}°</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModalState.isOpen}
        title="Hapus Preset Watermark?"
        description={`Apakah kamu yakin ingin menghapus preset "${deleteModalState.presetName}"? Riwayat foto yang sudah selesai diekspor tidak akan terpengaruh.`}
        confirmLabel="Hapus Preset"
        cancelLabel="Batal"
        isDestructive={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() =>
          setDeleteModalState({ isOpen: false, presetId: null, presetName: "" })
        }
      />
    </div>
  );
}
