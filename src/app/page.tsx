"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BoardSummary, MemberDTO } from "@/lib/types";

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
  const [member, setMember] = useState<MemberDTO | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSession() {
    const res = await fetchWithTimeout("/api/auth/session", { cache: "no-store" });
    if (!res.ok) {
      const response = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(response?.error ?? "Không thể kiểm tra trạng thái đăng nhập.");
      setSessionLoading(false);
      return;
    }

    const data = (await res.json()) as { member: MemberDTO | null };
    setMember(data.member);
    setSessionLoading(false);
  }

  async function loadBoards() {
    setLoading(true);
    try {
      const res = await fetchWithTimeout("/api/boards", { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          setBoards([]);
          setMember(null);
          setError(null);
          setLoading(false);
          return;
        }
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
    loadSession();
  }, []);

  useEffect(() => {
    if (!member) {
      setBoards([]);
      setLoading(false);
      return;
    }

    loadBoards();
  }, [member]);

  async function loginByEmail(e: React.FormEvent) {
    e.preventDefault();
    if (loggingIn) {
      return;
    }

    const email = loginEmail.trim().toLowerCase();
    if (!email) {
      setError("Vui lòng nhập email.");
      return;
    }

    setLoggingIn(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
        5000
      );
      const data = (await res.json().catch(() => null)) as
        | { error?: string; member?: MemberDTO }
        | null;

      if (!res.ok || !data?.member) {
        setError(data?.error ?? "Không thể đăng nhập.");
        return;
      }

      setMember(data.member);
      setLoginEmail("");
      setError(null);
    } catch {
      setError("Không thể kết nối đến máy chủ.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMember(null);
    setBoards([]);
    setTitle("");
  }

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
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Bảng công việc</h1>
          {member ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                {member.email}
              </span>
              <button
                onClick={logout}
                className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Đăng xuất
              </button>
            </div>
          ) : null}
        </div>
        <p className="text-sm text-slate-400">
          Quản lý công việc bằng bảng Kanban, danh sách và thẻ kéo thả.
        </p>
      </div>
      {error ? (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200">
          {error}
        </p>
      ) : null}

      {sessionLoading ? (
        <p className="text-slate-400">Đang kiểm tra phiên đăng nhập…</p>
      ) : !member ? (
        <form
          onSubmit={loginByEmail}
          className="max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
        >
          <h2 className="text-lg font-semibold">Đăng nhập bằng email</h2>
          <p className="mt-1 text-sm text-slate-400">
            Không cần mật khẩu. Email là bắt buộc để sử dụng bảng công việc.
          </p>
          <input
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            type="email"
            required
            placeholder="you@company.com"
            aria-label="Email đăng nhập"
            className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={loggingIn}
            className="mt-3 w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loggingIn ? "Đang đăng nhập…" : "Tiếp tục"}
          </button>
        </form>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
