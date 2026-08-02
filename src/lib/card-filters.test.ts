import { describe, expect, it } from "vitest";
import type { CardDTO } from "./types";
import {
  applyCardViewFilters,
  filterMyTasks,
  sortCards,
} from "./card-filters";

function card(partial: Partial<CardDTO> & Pick<CardDTO, "id">): CardDTO {
  return {
    title: partial.title ?? partial.id,
    description: null,
    assigneeMemberId: null,
    assigneeMemberEmail: null,
    assigneeMemberName: null,
    startDate: null,
    dueDate: null,
    position: 0,
    listId: "list-1",
    archivedAt: null,
    ...partial,
  };
}

describe("filterMyTasks", () => {
  it("returns all cards when disabled", () => {
    const cards = [
      card({ id: "a", assigneeMemberId: "u1" }),
      card({ id: "b", assigneeMemberId: "u2" }),
    ];
    expect(filterMyTasks(cards, "u1", false)).toHaveLength(2);
  });

  it("keeps only cards assigned to the current member", () => {
    const cards = [
      card({ id: "a", assigneeMemberId: "u1" }),
      card({ id: "b", assigneeMemberId: "u2" }),
      card({ id: "c", assigneeMemberId: null }),
    ];
    expect(filterMyTasks(cards, "u1", true).map((item) => item.id)).toEqual([
      "a",
    ]);
  });
});

describe("sortCards", () => {
  it("sorts by due date ascending with nulls last", () => {
    const cards = [
      card({ id: "c", dueDate: null, position: 2 }),
      card({ id: "a", dueDate: "2026-08-10", position: 0 }),
      card({ id: "b", dueDate: "2026-08-01", position: 1 }),
    ];
    expect(sortCards(cards, "dueDateAsc").map((item) => item.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("sorts by due date descending with nulls first", () => {
    const cards = [
      card({ id: "a", dueDate: "2026-08-01", position: 0 }),
      card({ id: "b", dueDate: null, position: 1 }),
      card({ id: "c", dueDate: "2026-08-10", position: 2 }),
    ];
    expect(sortCards(cards, "dueDateDesc").map((item) => item.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });
});

describe("applyCardViewFilters", () => {
  it("filters then sorts", () => {
    const cards = [
      card({
        id: "mine-late",
        assigneeMemberId: "u1",
        dueDate: "2026-08-20",
        position: 0,
      }),
      card({
        id: "other",
        assigneeMemberId: "u2",
        dueDate: "2026-08-01",
        position: 1,
      }),
      card({
        id: "mine-soon",
        assigneeMemberId: "u1",
        dueDate: "2026-08-05",
        position: 2,
      }),
    ];

    expect(
      applyCardViewFilters({
        cards,
        memberId: "u1",
        myTasksOnly: true,
        sortMode: "dueDateAsc",
      }).map((item) => item.id)
    ).toEqual(["mine-soon", "mine-late"]);
  });
});
