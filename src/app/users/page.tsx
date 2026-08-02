"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { ApiError, fetchJson } from "@/lib/api-client";
import type { MemberDTO } from "@/lib/types";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

/** Workspace-wide user management page (shared across all boards). */
export default function UsersPage() {
  const queryClient = useQueryClient();
  const { data: sessionData, isLoading: sessionLoading } = useSession();
  const member = sessionData?.member ?? null;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MemberDTO | null>(null);
  const [editName, setEditName] = useState("");

  const membersQuery = useQuery({
    queryKey: ["members"],
    enabled: Boolean(member),
    queryFn: () => fetchJson<MemberDTO[]>("/api/members", { cache: "no-store" }),
  });

  const createMember = useMutation({
    mutationFn: (payload: { email: string; name: string | null }) =>
      fetchJson<MemberDTO>("/api/members", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setEmail("");
      setName("");
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });

  const updateMember = useMutation({
    mutationFn: (payload: { id: string; name: string | null }) =>
      fetchJson<MemberDTO>(`/api/members/${payload.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: payload.name }),
      }),
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });

  const deleteMember = useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ ok: boolean }>(`/api/members/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });

  if (sessionLoading) {
    return <p className="text-muted-foreground">Đang tải…</p>;
  }

  if (!member) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <p className="text-muted-foreground">
          Vui lòng đăng nhập để quản lý người dùng.
        </p>
        <Button asChild className="mt-3" variant="outline">
          <Link href="/">Về trang chủ</Link>
        </Button>
      </div>
    );
  }

  async function onCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await createMember.mutateAsync({
        email: email.trim().toLowerCase(),
        name: name.trim() || null,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể thêm người dùng.");
    }
  }

  async function onSaveEdit() {
    if (!editing) return;
    setError(null);
    try {
      await updateMember.mutateAsync({
        id: editing.id,
        name: editName.trim() || null,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể cập nhật.");
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Quản lý người dùng
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Người dùng thuộc workspace dùng chung — có thể được giao việc trên mọi
          bảng.
        </p>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={onCreate}
        className="mb-8 grid max-w-2xl gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:grid-cols-[1fr_1fr_auto]"
      >
        <div className="space-y-2">
          <Label htmlFor="user-email">Email</Label>
          <Input
            id="user-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="member@company.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-name">Tên hiển thị</Label>
          <Input
            id="user-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Tùy chọn"
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={createMember.isPending} className="w-full">
            <UserPlus className="h-4 w-4" />
            {createMember.isPending ? "Đang thêm…" : "Thêm"}
          </Button>
        </div>
      </form>

      {membersQuery.isLoading ? (
        <p className="text-muted-foreground">Đang tải danh sách người dùng…</p>
      ) : (
        <ul className="space-y-2">
          {(membersQuery.data ?? []).map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {item.name || item.email}
                </p>
                {item.name ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {item.email}
                  </p>
                ) : null}
              </div>
              {item.id === member.id ? (
                <Badge variant="accent">Bạn</Badge>
              ) : null}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Sửa ${item.email}`}
                onClick={() => {
                  setEditing(item);
                  setEditName(item.name ?? "");
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Xóa ${item.email}`}
                disabled={item.id === member.id || deleteMember.isPending}
                onClick={async () => {
                  setError(null);
                  try {
                    await deleteMember.mutateAsync(item.id);
                  } catch (err) {
                    setError(
                      err instanceof ApiError
                        ? err.message
                        : "Không thể xóa người dùng."
                    );
                  }
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cập nhật người dùng</DialogTitle>
            <DialogDescription>
              {editing?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-name">Tên hiển thị</Label>
            <Input
              id="edit-name"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={onSaveEdit}
              disabled={updateMember.isPending}
            >
              {updateMember.isPending ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
