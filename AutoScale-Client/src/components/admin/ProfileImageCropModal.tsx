import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";

import { cx } from "../../lib/cx";
import { theme } from "../../styles/theme";

interface ProfileImageCropModalProps {
  file: File | null;
  title: string;
  onCancel: () => void;
  onSave: (file: File) => Promise<void> | void;
}

function loadImage(sourceUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load selected image"));
    image.src = sourceUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Unable to crop profile image"));
    }, "image/png", 0.94);
  });
}

function clampOffset(value: number): number {
  return Math.max(-100, Math.min(100, value));
}

export function ProfileImageCropModal({ file, title, onCancel, onSave }: ProfileImageCropModalProps) {
  const [scale, setScale] = useState(1.18);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const dragStartRef = useRef<{ offsetX: number; offsetY: number; pointerId: number; x: number; y: number } | null>(null);
  const sourceUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  useEffect(() => {
    setScale(1.18);
    setOffsetX(0);
    setOffsetY(0);
    setIsDragging(false);
    dragStartRef.current = null;
    setIsSaving(false);
  }, [file]);

  useEffect(() => {
    return () => {
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
    };
  }, [sourceUrl]);

  if (!file || !sourceUrl) {
    return null;
  }

  async function handleSave() {
    if (!file) {
      return;
    }

    const sourceFile = file;
    setIsSaving(true);
    try {
      const image = await loadImage(sourceUrl);
      const size = 768;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas is not available");
      }

      context.fillStyle = "#111111";
      context.fillRect(0, 0, size, size);
      const baseScale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
      const drawScale = baseScale * scale;
      const drawWidth = image.naturalWidth * drawScale;
      const drawHeight = image.naturalHeight * drawScale;
      const previewSize = 288;
      const drawX = (size - drawWidth) / 2 + (offsetX / previewSize) * size;
      const drawY = (size - drawHeight) / 2 + (offsetY / previewSize) * size;
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

      const blob = await canvasToBlob(canvas);
      const croppedFile = new File([blob], sourceFile.name.replace(/\.[^.]+$/, "") + "-profile.png", { type: "image/png" });
      await onSave(croppedFile);
    } finally {
      setIsSaving(false);
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (isSaving) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = {
      offsetX,
      offsetY,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    setIsDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    const dragStart = dragStartRef.current;
    if (!dragStart || dragStart.pointerId !== event.pointerId) {
      return;
    }

    setOffsetX(clampOffset(dragStart.offsetX + event.clientX - dragStart.x));
    setOffsetY(clampOffset(dragStart.offsetY + event.clientY - dragStart.y));
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>): void {
    const dragStart = dragStartRef.current;
    if (!dragStart || dragStart.pointerId !== event.pointerId) {
      return;
    }

    dragStartRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/62 px-4 py-6 backdrop-blur-md">
      <div className="glass-panel w-full max-w-4xl overflow-hidden rounded-[30px] border border-[color:var(--surface-border-strong)] bg-[color:var(--surface-card-strong)] shadow-[var(--shadow-card-strong)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--surface-border)] px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Profile image crop</p>
            <h3 className="font-display mt-2 text-2xl text-[color:var(--text-strong)]">{title}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-muted)]">
              Position the image inside the circle, adjust the scale, then save the cropped profile asset.
            </p>
          </div>
          <button className={theme.buttonSecondary} disabled={isSaving} onClick={onCancel} type="button">
            Close
          </button>
        </div>

        <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex items-center justify-center rounded-[28px] border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-6">
            <div
              className={cx(
                "relative h-72 w-72 touch-none select-none overflow-hidden rounded-full border border-white/14 bg-black/24 shadow-[0_26px_70px_rgba(0,0,0,0.28)]",
                isDragging ? "cursor-grabbing" : "cursor-grab",
              )}
              onPointerCancel={handlePointerEnd}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              role="presentation"
            >
              <img
                alt="Profile crop preview"
                className="pointer-events-none absolute left-1/2 top-1/2 h-full w-full object-cover"
                draggable={false}
                src={sourceUrl}
                style={{ transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) scale(${scale})` }}
              />
              <div aria-hidden="true" className="absolute inset-0 rounded-full ring-2 ring-inset ring-white/28" />
              <div className="pointer-events-none absolute inset-x-0 bottom-5 mx-auto w-max rounded-full border border-white/12 bg-black/44 px-3 py-1 text-xs font-semibold text-white/72 opacity-80">
                Drag to reposition
              </div>
            </div>
          </div>

          <div className="space-y-5 rounded-[28px] border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-5">
            <label className="block space-y-3">
              <span className="text-sm font-semibold text-[color:var(--text-strong)]">Scale</span>
              <input max="2.6" min="1" onChange={(event) => setScale(Number(event.target.value))} step="0.01" type="range" value={scale} />
            </label>

            <label className="block space-y-3">
              <span className="text-sm font-semibold text-[color:var(--text-strong)]">Horizontal position</span>
              <input max="100" min="-100" onChange={(event) => setOffsetX(clampOffset(Number(event.target.value)))} step="1" type="range" value={offsetX} />
            </label>

            <label className="block space-y-3">
              <span className="text-sm font-semibold text-[color:var(--text-strong)]">Vertical position</span>
              <input max="100" min="-100" onChange={(event) => setOffsetY(clampOffset(Number(event.target.value)))} step="1" type="range" value={offsetY} />
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Center", () => { setOffsetX(0); setOffsetY(0); }],
                ["Zoom in", () => setScale((current) => Math.min(2.6, Number((current + 0.12).toFixed(2))))],
                ["Reset", () => { setScale(1.18); setOffsetX(0); setOffsetY(0); }],
              ].map(([label, handler]) => (
                <button key={String(label)} className={cx(theme.buttonSecondary, "justify-center")} disabled={isSaving} onClick={handler as () => void} type="button">
                  {String(label)}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-[color:var(--surface-border)] pt-5">
              <button className={theme.buttonSecondary} disabled={isSaving} onClick={onCancel} type="button">
                Cancel
              </button>
              <button className={theme.buttonPrimary} disabled={isSaving} onClick={() => void handleSave()} type="button">
                {isSaving ? "Saving crop..." : "Save cropped image"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
