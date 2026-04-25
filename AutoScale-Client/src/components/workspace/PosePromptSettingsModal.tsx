import { useEffect, useState } from "react";

import { cx } from "../../lib/cx";
import { theme } from "../../styles/theme";

interface PosePromptSettingsModalProps {
  open: boolean;
  visibleCount: number;
  templates: string[];
  usesSharedDefaults: boolean;
  onClose: () => void;
  onSave: (nextTemplates: string[]) => Promise<void> | void;
  onResetToShared?: () => Promise<void> | void;
}

function normalizeTemplates(templates: string[]): string[] {
  return Array.from({ length: 4 }, (_, index) => templates[index] ?? "");
}

export function PosePromptSettingsModal({ open, visibleCount, templates, usesSharedDefaults, onClose, onSave, onResetToShared }: PosePromptSettingsModalProps) {
  const [draftTemplates, setDraftTemplates] = useState<string[]>(() => normalizeTemplates(templates));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraftTemplates(normalizeTemplates(templates));
      setIsSaving(false);
    }
  }, [open, templates]);

  if (!open) {
    return null;
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave(normalizeTemplates(draftTemplates));
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResetToShared() {
    if (!onResetToShared) {
      return;
    }

    setIsSaving(true);
    try {
      await onResetToShared();
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-md">
      <div
        className={cx(
          "w-full max-w-3xl rounded-[28px] border border-[color:var(--surface-border-strong)] bg-[color:var(--surface-card-strong)] p-5 shadow-[var(--shadow-card-strong)]",
          "glass-panel",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--surface-border)] pb-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[color:var(--text-muted)]">Pose Prompt Settings</p>
            <h3 className="font-display mt-2 text-2xl text-[color:var(--text-strong)]">Custom multiplied prompt set</h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--text-muted)]">
              {usesSharedDefaults
                ? "This row is currently using the shared custom prompt set. Edit below to create a row-specific override."
                : "This row has its own pose prompt override. You can keep editing it or reset back to the shared defaults."}
            </p>
          </div>
          <button className={theme.buttonSecondary} disabled={isSaving} onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {Array.from({ length: visibleCount }, (_, index) => (
            <label key={index} className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Generated image {index + 1}</span>
              <textarea
                className={theme.input + " min-h-[108px] resize-y"}
                value={draftTemplates[index] ?? ""}
                onChange={(event) =>
                  setDraftTemplates((current) => {
                    const nextTemplates = normalizeTemplates(current);
                    nextTemplates[index] = event.target.value;
                    return nextTemplates;
                  })
                }
                placeholder={`Describe the pose direction for generated image ${index + 1}`}
              />
            </label>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-[color:var(--surface-border)] pt-4">
          {!usesSharedDefaults && onResetToShared ? (
            <button className={theme.buttonSecondary} disabled={isSaving} onClick={() => void handleResetToShared()} type="button">
              Use shared defaults
            </button>
          ) : null}
          <button className={theme.buttonSecondary} disabled={isSaving} onClick={onClose} type="button">
            Cancel
          </button>
          <button className={theme.buttonPrimary} disabled={isSaving} onClick={() => void handleSave()} type="button">
            {isSaving ? "Saving..." : "Save prompts"}
          </button>
        </div>
      </div>
    </div>
  );
}