import type { CardDTO } from "@/lib/types";

export type TaskSortMode = "position" | "dueDateAsc" | "dueDateDesc";

/**
 * Filter cards assigned to the current member when "My tasks" is active.
 */
export function filterMyTasks(
  cards: CardDTO[],
  memberId: string | null,
  enabled: boolean
): CardDTO[] {
  if (!enabled || !memberId) {
    return cards;
  }
  return cards.filter((card) => card.assigneeMemberId === memberId);
}

/**
 * Sort cards by position or due date. Null due dates sort last for ascending,
 * and first for descending so undated work stays visible.
 */
export function sortCards(cards: CardDTO[], mode: TaskSortMode): CardDTO[] {
  if (mode === "position") {
    return [...cards].sort((a, b) => a.position - b.position);
  }

  const ascending = mode === "dueDateAsc";
  return [...cards].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) {
      return a.position - b.position;
    }
    if (!a.dueDate) {
      return ascending ? 1 : -1;
    }
    if (!b.dueDate) {
      return ascending ? -1 : 1;
    }
    if (a.dueDate === b.dueDate) {
      return a.position - b.position;
    }
    return ascending
      ? a.dueDate.localeCompare(b.dueDate)
      : b.dueDate.localeCompare(a.dueDate);
  });
}

/** Apply my-tasks filter then sort for board list rendering. */
export function applyCardViewFilters(params: {
  cards: CardDTO[];
  memberId: string | null;
  myTasksOnly: boolean;
  sortMode: TaskSortMode;
}): CardDTO[] {
  const filtered = filterMyTasks(
    params.cards,
    params.memberId,
    params.myTasksOnly
  );
  return sortCards(filtered, params.sortMode);
}
