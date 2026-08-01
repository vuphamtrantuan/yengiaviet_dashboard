"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BoardSummary } from "@/lib/types";

export default function HomePage() {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function loadBoards() {
    const res = await fetch("/api/boards", { cache: "no-store" });
    const data = (await res.json()) as BoardSummary[];
    setBoards(data);
    setLoading(false);
  }

  useEffect(() => {
    loadBoards();
  }, []);

  async function createBoard(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    await fetch("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    setTitle("");
    setCreating(false);
    await loadBoards();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Your boards</h1>
        <p className="text-sm text-slate-400">
          Organize work into boards, lists, and draggable cards.
        </p>
      </div>

      <form onSubmit={createBoard} className="mb-8 flex max-w-md gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New board title…"
          aria-label="New board title"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          disabled={creating || !title.trim()}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create board"}
        </button>
      </form>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : boards.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-slate-400">
          No boards yet. Create your first board above.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <li key={board.id}>
              <Link
                href={`/boards/${board.id}`}
                className="block h-28 rounded-xl border border-slate-800 bg-gradient-to-br from-slate-800 to-slate-900 p-4 transition hover:border-sky-500 hover:shadow-lg hover:shadow-sky-500/10"
              >
                <p className="text-lg font-semibold">{board.title}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {board._count.lists} list{board._count.lists === 1 ? "" : "s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
