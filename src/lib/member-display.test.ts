import { describe, expect, it } from "vitest";
import { assigneeDisplayName, memberDisplayName } from "./member-display";

describe("memberDisplayName", () => {
  it("prefers name over email", () => {
    expect(memberDisplayName({ name: "An", email: "an@ex.com" })).toBe("An");
  });

  it("falls back to email when name is empty", () => {
    expect(memberDisplayName({ name: "  ", email: "an@ex.com" })).toBe(
      "an@ex.com"
    );
  });
});

describe("assigneeDisplayName", () => {
  it("shows name instead of email when available", () => {
    expect(assigneeDisplayName("Bình", "binh@ex.com")).toBe("Bình");
  });

  it("falls back to email, then Chưa gán", () => {
    expect(assigneeDisplayName(null, "binh@ex.com")).toBe("binh@ex.com");
    expect(assigneeDisplayName(null, null)).toBe("Chưa gán");
  });
});
