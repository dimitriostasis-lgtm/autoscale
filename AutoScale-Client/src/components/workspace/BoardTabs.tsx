import { theme } from "../../styles/theme";
import { cx } from "../../lib/cx";

interface BoardTabItem {
  id: string;
  name: string;
  updatedAt: string;
}

interface BoardTabsProps {
  boards: BoardTabItem[];
  activeBoardId: string | null;
  onSelect: (boardId: string) => void;
  onCreate: () => void;
}

export function BoardTabs({ boards, activeBoardId, onSelect, onCreate }: BoardTabsProps) {
  return (
    <div className={cx(theme.cardStrong, "flex flex-wrap items-center gap-3 px-4 py-4") + " glass-panel"}>
      {boards.map((board) => {
        const active = board.id === activeBoardId;
        return (
          <button
            key={board.id}
            className={cx(
              "rounded-2xl px-4 py-3 text-left text-sm transition",
              active
                ? "bg-[rgba(199,255,39,0.16)] text-lime-100 ring-1 ring-lime-300/30"
                : "border border-white/8 bg-white/[0.03] text-white/66 hover:bg-white/[0.06]",
            )}
            onClick={() => onSelect(board.id)}
            type="button"
          >
            <span className="block font-semibold text-white">{board.name}</span>
            <span className="mt-1 block text-xs uppercase tracking-[0.16em] text-white/36">
              {new Date(board.updatedAt).toLocaleDateString()}
            </span>
          </button>
        );
      })}
      <button className={theme.buttonSecondary} onClick={onCreate} type="button">
        + Add Table
      </button>
    </div>
  );
}