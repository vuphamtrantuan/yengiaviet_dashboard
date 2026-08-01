import { describe, expect, it } from "vitest";
import { computeMove, insertAt, nextPosition, removeItem, reorder } from "./board";

describe("reorder", () => {
  it("moves an item forward", () => {
    expect(reorder(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an item backward", () => {
    expect(reorder(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("is a no-op when indices match", () => {
    expect(reorder(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"]);
  });
});

describe("insertAt", () => {
  it("inserts at the given index", () => {
    expect(insertAt(["a", "c"], 1, "b")).toEqual(["a", "b", "c"]);
  });

  it("clamps an out-of-range index to the end", () => {
    expect(insertAt(["a", "b"], 99, "c")).toEqual(["a", "b", "c"]);
  });

  it("clamps a negative index to the start", () => {
    expect(insertAt(["a", "b"], -5, "c")).toEqual(["c", "a", "b"]);
  });
});

describe("removeItem", () => {
  it("removes an existing item", () => {
    expect(removeItem(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("returns an unchanged copy when the item is missing", () => {
    expect(removeItem(["a", "b"], "z")).toEqual(["a", "b"]);
  });
});

describe("nextPosition", () => {
  it("returns 0 for an empty list", () => {
    expect(nextPosition([])).toBe(0);
  });

  it("returns max + 1", () => {
    expect(nextPosition([0, 3, 1])).toBe(4);
  });
});

describe("computeMove", () => {
  it("reorders within the same list", () => {
    const result = computeMove({
      cardId: "b",
      sourceOrder: ["a", "b", "c"],
      destOrder: ["a", "b", "c"],
      sameList: true,
      destIndex: 2,
    });
    expect(result.destOrder).toEqual(["a", "c", "b"]);
    expect(result.sourceOrder).toEqual(["a", "c", "b"]);
  });

  it("moves a card between two lists", () => {
    const result = computeMove({
      cardId: "b",
      sourceOrder: ["a", "b", "c"],
      destOrder: ["x", "y"],
      sameList: false,
      destIndex: 1,
    });
    expect(result.sourceOrder).toEqual(["a", "c"]);
    expect(result.destOrder).toEqual(["x", "b", "y"]);
  });
});
