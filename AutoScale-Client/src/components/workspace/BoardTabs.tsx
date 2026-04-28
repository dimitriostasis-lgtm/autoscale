import type { ReactNode } from "react";

import { theme } from "../../styles/theme";
import { cx } from "../../lib/cx";

interface BoardTabItem {
  id: string;
  name: string;
  updatedAt: string;
  layoutLabel?: string | null;
}

interface BoardTabsProps {
  boards: BoardTabItem[];
  activeBoardId: string | null;
  onSelect: (boardId: string) => void;
  onCreate: () => void;
  onDelete: (boardId: string) => void;
  rightAddon?: ReactNode;
}

export function BoardTabs({ boards, activeBoardId, onSelect, onCreate, onDelete, rightAddon }: BoardTabsProps) {
  return (
    <div className="border-b border-white/8 bg-[#232323] px-3 py-2 sm:px-4">
      <div className="flex min-h-[64px] items-stretch gap-3">
        <div className="flex min-w-0 flex-1 flex-nowrap items-stretch gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-1">
          {boards.map((board) => {
            const active = board.id === activeBoardId;
            const layoutLabel = board.layoutLabel;
            return (
              <div
                key={board.id}
                className={cx(
                  "flex h-14 w-40 shrink-0 items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-200",
                  active
                    ? "border-[#4e6b22] bg-[#314513] text-[#dcf6a0]"
                    : "border-white/8 bg-[#2b2b2b] text-white/60 hover:bg-[#313131]",
                )}
              >
                <button className="min-w-0 flex-1 text-left" onClick={() => onSelect(board.id)} type="button">
                  <span className="block truncate font-semibold text-white">{board.name}</span>
                  <span
                    className={cx(
                      "mt-1 block truncate text-[10px] uppercase tracking-[0.16em]",
                      layoutLabel ? (active ? "font-bold text-lime-100/78" : "font-bold text-lime-100/54") : "text-white/34",
                    )}
                  >
                    {layoutLabel || `Updated ${new Date(board.updatedAt).toLocaleDateString()}`}
                  </span>
                </button>
                <button
                  aria-label={`Delete ${board.name}`}
                  className={cx(
                    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors duration-200",
                    active
                      ? "border-black/10 bg-black/20 text-[#dcf6a0] hover:bg-black/30"
                      : "border-white/10 bg-black/15 text-white/56 hover:bg-black/25 hover:text-white/76",
                    boards.length <= 1 ? "cursor-not-allowed opacity-45" : "",
                  )}
                  disabled={boards.length <= 1}
                  onClick={() => onDelete(board.id)}
                  type="button"
                >
                  x
                </button>
              </div>
            );
          })}
          <button
            className={
              theme.buttonSecondary +
              " h-14 shrink-0 rounded-lg border-white/8 bg-[#2b2b2b] px-3 py-2 text-xs text-white/80 transition-colors duration-200 hover:bg-[#313131]"
            }
            onClick={onCreate}
            type="button"
          >
            + Add table
          </button>
        </div>
        {rightAddon ? <div className="hidden shrink-0 items-center pb-1 lg:flex">{rightAddon}</div> : null}
      </div>
    </div>
  );
}
