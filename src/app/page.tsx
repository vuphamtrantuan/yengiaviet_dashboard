"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BoardSummary } from "@/lib/types";

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function HomePage() {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadBoards() {
    try {
      const res = await fetchWithTimeout("/api/boards", { cache: "no-store" });
      if (!res.ok) {
        const response = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(response?.error ?? "Không thể tải danh sách bảng.");
        setBoards([]);
        setLoading(false);
        return;
      }

      const data = (await res.json()) as unknown;
      setBoards(Array.isArray(data) ? (data as BoardSummary[]) : []);
      setError(null);
      setLoading(false);
    } catch {
      setError("Không thể kết nối đến máy chủ.");
      setBoards([]);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBoards();
  }, []);

  async function createBoard(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const res = await fetchWithTimeout(
        "/api/boards",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmed }),
        },
        5000
      );
      if (!res.ok) {
        const response = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(response?.error ?? "Không thể tạo bảng mới.");
        return;
      }
      setTitle("");
      await loadBoards();
    } catch {
      setError("Không thể kết nối đến máy chủ.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Bảng công việc</h1>
        <p className="text-sm text-slate-400">
          Quản lý công việc bằng bảng Kanban, danh sách và thẻ kéo thả.
        </p>
      </div>

      <form onSubmit={createBoard} className="mb-8 flex max-w-md gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tên bảng mới…"
          aria-label="Tên bảng mới"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          disabled={creating || !title.trim()}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? "Đang tạo…" : "Tạo bảng"}
        </button>
      </form>

      {loading ? (
        <p className="text-slate-400">Đang tải…</p>
      ) : error ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200">
          {error}
        </p>
      ) : boards.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-slate-400">
          Chưa có bảng nào. Hãy tạo bảng đầu tiên ở phía trên.
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
                  {board._count.lists} danh sách
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
