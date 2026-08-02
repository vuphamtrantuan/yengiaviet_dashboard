"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { ApiError, fetchJson } from "@/lib/api-client";
import type { BoardSummary } from "@/lib/types";
import { useLogin, useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function HomePage() {
  const queryClient = useQueryClient();
  const { data: sessionData, isLoading: sessionLoading, error: sessionError } =
    useSession();
  const member = sessionData?.member ?? null;
  const login = useLogin();
  const [loginEmail, setLoginEmail] = useState("");
  const [title, setTitle] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<BoardSummary | null>(null);
  const [archiving, setArchiving] = useState(false);

  const boardsQuery = useQuery({
    queryKey: ["boards", "active"],
    enabled: Boolean(member),
    queryFn: () =>
      fetchJson<BoardSummary[]>("/api/boards", { cache: "no-store" }),
  });

  const archivedBoardsQuery = useQuery({
    queryKey: ["boards", "archived"],
    enabled: Boolean(member) && showArchived,
    queryFn: () =>
      fetchJson<BoardSummary[]>("/api/boards?archived=1", {
        cache: "no-store",
      }),
  });

  const createBoard = useMutation({
    mutationFn: (boardTitle: string) =>
      fetchJson<BoardSummary>("/api/boards", {
        method: "POST",
        body: JSON.stringify({ title: boardTitle }),
      }),
    onSuccess: () => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["boards"] });
    },
  });

  async function onLogin(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      await login.mutateAsync(loginEmail.trim().toLowerCase());
      setLoginEmail("");
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "Không thể đăng nhập."
      );
    }
  }

  async function onCreateBoard(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setFormError(null);
    try {
      await createBoard.mutateAsync(trimmed);
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "Không thể tạo bảng."
      );
    }
  }

  async function setBoardArchived(boardId: string, archived: boolean) {
    setArchiving(true);
    setFormError(null);
    try {
      await fetchJson<BoardSummary>(`/api/boards/${boardId}`, {
        method: "PATCH",
        body: JSON.stringify({ archived }),
      });
      await queryClient.invalidateQueries({ queryKey: ["boards"] });
      setArchiveTarget(null);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Không thể cập nhật lưu trữ bảng."
      );
    } finally {
      setArchiving(false);
    }
  }

  const errorMessage =
    formError ||
    (sessionError instanceof Error ? sessionError.message : null) ||
    (boardsQuery.error instanceof Error ? boardsQuery.error.message : null);

  return (
    <div className="animate-fade-up">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Bảng công việc chung
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nhà Yến Vui Vẻ — quản lý công việc Kanban dùng chung cho cả đội.
          </p>
        </div>
        {member ? (
          <Button
            type="button"
            variant={showArchived ? "default" : "outline"}
            onClick={() => setShowArchived((open) => !open)}
          >
            <Archive className="h-4 w-4" />
            {showArchived ? "Ẩn bảng lưu trữ" : "Bảng đã lưu trữ"}
          </Button>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {errorMessage}
        </p>
      ) : null}

      {sessionLoading ? (
        <p className="text-muted-foreground">Đang kiểm tra phiên đăng nhập…</p>
      ) : !member ? (
        <form
          onSubmit={onLogin}
          className="max-w-md animate-fade-in rounded-2xl border bg-card p-6 shadow-sm"
        >
          <h2 className="font-display text-lg font-semibold">
            Đăng nhập bằng email
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Không cần mật khẩu. Email xác định bạn trong workspace dùng chung.
          </p>
          <div className="mt-4 space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              type="email"
              required
              placeholder="you@company.com"
            />
          </div>
          <Button
            type="submit"
            className="mt-4 w-full"
            disabled={login.isPending}
          >
            {login.isPending ? "Đang đăng nhập…" : "Tiếp tục"}
          </Button>
        </form>
      ) : (
        <>
          <form
            onSubmit={onCreateBoard}
            className="mb-8 flex max-w-lg flex-col gap-2 sm:flex-row"
          >
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Tên bảng mới…"
              aria-label="Tên bảng mới"
            />
            <Button
              type="submit"
              disabled={createBoard.isPending || !title.trim()}
            >
              <Plus className="h-4 w-4" />
              {createBoard.isPending ? "Đang tạo…" : "Tạo bảng"}
            </Button>
          </form>

          {boardsQuery.isLoading ? (
            <p className="text-muted-foreground">Đang tải…</p>
          ) : !boardsQuery.data?.length ? (
            <p className="rounded-xl border border-dashed border-border bg-card/60 p-10 text-center text-muted-foreground">
              Chưa có bảng nào. Hãy tạo bảng đầu tiên ở phía trên.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {boardsQuery.data.map((board, index) => (
                <li
                  key={board.id}
                  className="animate-fade-up group relative"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  <Link
                    href={`/boards/${board.id}`}
                    className="block h-28 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:shadow-md"
                  >
                    <p className="font-display text-lg font-semibold">
                      {board.title}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {board._count.lists} danh sách · dùng chung workspace
                    </p>
                  </Link>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={`Lưu trữ bảng ${board.title}`}
                    onClick={() => setArchiveTarget(board)}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {showArchived ? (
            <section className="mt-10 animate-fade-in rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="font-display text-lg font-semibold">
                Bảng đã lưu trữ
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Các bảng lưu trữ được tải riêng và không hiện trong danh sách
                chính.
              </p>
              {archivedBoardsQuery.isLoading ? (
                <p className="mt-4 text-sm text-muted-foreground">Đang tải…</p>
              ) : !archivedBoardsQuery.data?.length ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Chưa có bảng lưu trữ.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {archivedBoardsQuery.data.map((board) => (
                    <li
                      key={board.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border bg-secondary/40 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{board.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {board._count.lists} danh sách
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setBoardArchived(board.id, false)}
                        disabled={archiving}
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" />
                        Khôi phục
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </>
      )}

      <AlertDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open && !archiving) {
            setArchiveTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lưu trữ bảng này?</AlertDialogTitle>
            <AlertDialogDescription>
              Bảng “{archiveTarget?.title}” sẽ được ẩn khỏi danh sách chính. Bạn
              có thể khôi phục sau từ “Bảng đã lưu trữ”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              disabled={archiving || !archiveTarget}
              onClick={(event) => {
                event.preventDefault();
                if (archiveTarget) {
                  void setBoardArchived(archiveTarget.id, true);
                }
              }}
            >
              {archiving ? "Đang lưu trữ…" : "Xác nhận lưu trữ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
