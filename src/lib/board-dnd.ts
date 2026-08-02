import type { CardDTO, ListDTO } from "./types";
import { computeMove } from "./board";

/**
 * Apply a drag-and-drop result to board lists using the currently rendered
 * card order as the source of truth (matches @hello-pangea/dnd indices).
 */
export function applyCardDragToLists(params: {
  lists: ListDTO[];
  sourceListId: string;
  destListId: string;
  cardId: string;
  destIndex: number;
}): ListDTO[] | null {
  const { lists, sourceListId, destListId, cardId, destIndex } = params;
  const sourceList = lists.find((list) => list.id === sourceListId);
  const destList = lists.find((list) => list.id === destListId);
  if (!sourceList || !destList) {
    return null;
  }

  const sameList = sourceListId === destListId;
  const { sourceOrder, destOrder } = computeMove({
    cardId,
    sourceOrder: sourceList.cards.map((card) => card.id),
    destOrder: destList.cards.map((card) => card.id),
    sameList,
    destIndex,
  });

  const byId = new Map<string, CardDTO>();
  lists.forEach((list) => {
    list.cards.forEach((card) => byId.set(card.id, card));
  });

  if (!byId.has(cardId)) {
    return null;
  }

  return lists.map((list) => {
    if (list.id === sourceListId) {
      return {
        ...list,
        cards: sourceOrder.map((id, index) => ({
          ...(byId.get(id) as CardDTO),
          listId: sourceListId,
          position: index,
        })),
      };
    }

    if (!sameList && list.id === destListId) {
      return {
        ...list,
        cards: destOrder.map((id, index) => ({
          ...(byId.get(id) as CardDTO),
          listId: destListId,
          position: index,
        })),
      };
    }

    return list;
  });
}
