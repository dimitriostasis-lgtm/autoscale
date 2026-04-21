import { useEffect, useMemo, useState } from "react";

import { cx } from "../../lib/cx";
import { theme } from "../../styles/theme";
import type { AgencyRecord, UserRecord } from "../../types";

interface AgencyDeleteModalProps {
  open: boolean;
  agency: AgencyRecord | null;
  affectedUsers: UserRecord[];
  retainedPlatformAdmins: UserRecord[];
  currentUser: UserRecord;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function AgencyDeleteModal({
  open,
  agency,
  affectedUsers,
  retainedPlatformAdmins,
  currentUser,
  onClose,
  onConfirm,
}: AgencyDeleteModalProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setConfirmationText("");
    setHasAcknowledged(false);
    setIsSubmitting(false);
  }, [agency?.id, open]);

  const roleBreakdown = useMemo(
    () => ({
      agencyAdmins: affectedUsers.filter((user) => user.role === "AGENCY_ADMIN").length,
      managers: affectedUsers.filter((user) => user.role === "AGENCY_MANAGER").length,
      users: affectedUsers.filter((user) => user.role === "USER").length,
    }),
    [affectedUsers],
  );

  const includesCurrentUser = affectedUsers.some((user) => user.id === currentUser.id);
  const retainsCurrentPlatformAdmin = retainedPlatformAdmins.some((user) => user.id === currentUser.id);

  if (!open || !agency) {
    return null;
  }

  const canConfirm = hasAcknowledged && confirmationText.trim() === agency.name && !isSubmitting;

  async function handleConfirm(): Promise<void> {
    if (!canConfirm) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md">
      <div className={cx(theme.cardStrong, "glass-panel w-full max-w-3xl p-6 sm:p-7")}>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-rose-200/68">Destructive action</p>
            <h3 className="font-display mt-2 text-3xl text-white">Delete agency permanently</h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/58">
              This removes <span className="font-semibold text-white">{agency.name}</span> and permanently deletes every account, board, influencer assignment, and generated asset attached to that agency.
            </p>
          </div>
          <button className={theme.buttonSecondary} onClick={onClose} type="button">
            Cancel
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-[28px] border border-rose-400/20 bg-rose-400/10 p-5">
            <p className="text-sm font-semibold text-rose-100">This action cannot be undone.</p>
            <p className="mt-2 text-sm leading-7 text-rose-100/76">
              {affectedUsers.length} account{affectedUsers.length === 1 ? "" : "s"} in this agency will be deleted together with their workspace boards and generated content.
            </p>
          </div>

          {retainedPlatformAdmins.length ? (
            <div className="rounded-[28px] border border-sky-300/18 bg-sky-300/10 p-5 text-sm leading-7 text-sky-100/82">
              {retainedPlatformAdmins.length} platform admin{retainedPlatformAdmins.length === 1 ? " is" : "s are"} assigned to this agency and will be kept. Their agency assignment will be cleared when the agency is deleted.
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-3">
            {[
              ["Agency Admins", roleBreakdown.agencyAdmins],
              ["Managers", roleBreakdown.managers],
              ["Users", roleBreakdown.users],
            ].map(([label, value]) => (
              <div key={label} className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-white/42">{label}</p>
                <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>

          {affectedUsers.length ? (
            <div className="rounded-[28px] border border-white/8 bg-black/14 p-5">
              <p className="text-sm font-semibold text-white">Accounts that will be removed</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {affectedUsers.slice(0, 8).map((user) => (
                  <span key={user.id} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/72">
                    {user.name}
                  </span>
                ))}
                {affectedUsers.length > 8 ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/52">
                    +{affectedUsers.length - 8} more
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {includesCurrentUser ? (
            <div className="rounded-[28px] border border-amber-300/20 bg-amber-300/10 p-5 text-sm leading-7 text-amber-100/82">
              Your current account belongs to this agency. Confirming this deletion will also remove your account and end your current session.
            </div>
          ) : null}

          {retainsCurrentPlatformAdmin ? (
            <div className="rounded-[28px] border border-sky-300/18 bg-sky-300/10 p-5 text-sm leading-7 text-sky-100/82">
              Your platform admin account will remain active. This action only removes your assignment to {agency.name}.
            </div>
          ) : null}

          <label className="flex items-start gap-3 rounded-[28px] border border-white/8 bg-white/[0.03] p-4 text-sm text-white/74">
            <input
              checked={hasAcknowledged}
              className="mt-1"
              onChange={(event) => setHasAcknowledged(event.target.checked)}
              type="checkbox"
            />
            <span>I understand that deleting this agency permanently removes all agency-scoped accounts, boards, assignments, and outputs inside it, while platform admins are retained and detached.</span>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-white/80">Type the agency name to confirm</span>
            <input
              className={theme.input}
              placeholder={agency.name}
              value={confirmationText}
              onChange={(event) => setConfirmationText(event.target.value)}
            />
          </label>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/8 pt-5">
            <button className={theme.buttonSecondary} onClick={onClose} type="button">
              Cancel
            </button>
            <button className={theme.buttonDanger} disabled={!canConfirm} onClick={() => void handleConfirm()} type="button">
              {isSubmitting ? "Deleting agency..." : "Delete agency permanently"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}