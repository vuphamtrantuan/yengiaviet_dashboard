/**
 * Pure, framework-agnostic ordering helpers used by the Kanban board.
 *
 * Positions are stored as sequential integers within each list (and lists
 * within a board). Whenever items are reordered we recompute a dense
 * sequential ordering, which keeps the logic trivial to reason about and test.
 */

/** Return a copy of `list` with the item at `startIndex` moved to `endIndex`. */
export function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = [...list];
  const [removed] = result.splice(startIndex, 1);
  if (removed === undefined) {
    return result;
  }
  result.splice(endIndex, 0, removed);
  return result;
}

/** Return a copy of `list` with `item` inserted at `index` (clamped to bounds). */
export function insertAt<T>(list: T[], index: number, item: T): T[] {
  const result = [...list];
  const safeIndex = Math.max(0, Math.min(index, result.length));
  result.splice(safeIndex, 0, item);
  return result;
}

/** Return a copy of `list` with the first occurrence of `item` removed. */
export function removeItem<T>(list: T[], item: T): T[] {
  const result = [...list];
  const index = result.indexOf(item);
  if (index !== -1) {
    result.splice(index, 1);
  }
  return result;
}

/** Next append position given existing positions (max + 1, or 0 when empty). */
export function nextPosition(positions: number[]): number {
  if (positions.length === 0) {
    return 0;
  }
  return Math.max(...positions) + 1;
}

/**
 * Compute the position update plan when moving a card between (or within)
 * lists. Given the ordered card ids for the source and destination lists,
 * returns the new dense ordering for each affected list.
 */
export function computeMove(params: {
  cardId: string;
  sourceOrder: string[];
  destOrder: string[];
  sameList: boolean;
  destIndex: number;
}): { sourceOrder: string[]; destOrder: string[] } {
  const { cardId, sourceOrder, destOrder, sameList, destIndex } = params;

  if (sameList) {
    const startIndex = sourceOrder.indexOf(cardId);
    const reordered = reorder(sourceOrder, startIndex, destIndex);
    return { sourceOrder: reordered, destOrder: reordered };
  }

  const newSource = removeItem(sourceOrder, cardId);
  const newDest = insertAt(destOrder, destIndex, cardId);
  return { sourceOrder: newSource, destOrder: newDest };
}
