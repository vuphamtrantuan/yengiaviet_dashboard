import { describe, expect, it } from "vitest";
import type { CardDTO, ListDTO } from "./types";
import { applyCardDragToLists } from "./board-dnd";

function card(
  partial: Partial<CardDTO> & Pick<CardDTO, "id" | "listId" | "position">
): CardDTO {
  return {
    title: partial.title ?? partial.id,
    description: null,
    assigneeMemberId: null,
    assigneeMemberEmail: null,
    assigneeMemberName: null,
    startDate: null,
    dueDate: null,
    archivedAt: null,
    ...partial,
  };
}

function list(id: string, cards: CardDTO[]): ListDTO {
  return {
    id,
    title: id,
    position: 0,
    boardId: "board-1",
    cards,
  };
}

describe("applyCardDragToLists", () => {
  it("moves a card into the middle of another list", () => {
    const lists = [
      list("todo", [
        card({ id: "a", listId: "todo", position: 0 }),
        card({ id: "b", listId: "todo", position: 1 }),
      ]),
      list("doing", [
        card({ id: "x", listId: "doing", position: 0 }),
        card({ id: "y", listId: "doing", position: 1 }),
      ]),
    ];

    const next = applyCardDragToLists({
      lists,
      sourceListId: "todo",
      destListId: "doing",
      cardId: "a",
      destIndex: 1,
    });

    expect(next?.find((item) => item.id === "todo")?.cards.map((c) => c.id)).toEqual([
      "b",
    ]);
    expect(next?.find((item) => item.id === "doing")?.cards.map((c) => c.id)).toEqual([
      "x",
      "a",
      "y",
    ]);
    expect(
      next?.find((item) => item.id === "doing")?.cards.map((c) => c.position)
    ).toEqual([0, 1, 2]);
    expect(next?.find((item) => item.id === "doing")?.cards[1]?.listId).toBe(
      "doing"
    );
  });

  it("moves a card to the end of another list", () => {
    const lists = [
      list("todo", [card({ id: "a", listId: "todo", position: 0 })]),
      list("done", [
        card({ id: "x", listId: "done", position: 0 }),
        card({ id: "y", listId: "done", position: 1 }),
      ]),
    ];

    const next = applyCardDragToLists({
      lists,
      sourceListId: "todo",
      destListId: "done",
      cardId: "a",
      destIndex: 2,
    });

    expect(next?.find((item) => item.id === "done")?.cards.map((c) => c.id)).toEqual([
      "x",
      "y",
      "a",
    ]);
  });
});
