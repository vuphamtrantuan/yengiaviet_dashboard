"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, fetchJson } from "@/lib/api-client";
import type { MemberDTO } from "@/lib/types";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Let the current user update their display name used on assignees. */
export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: sessionData, isLoading } = useSession();
  const member = sessionData?.member ?? null;
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(member?.name ?? "");
  }, [member?.name]);

  const saveProfile = useMutation({
    mutationFn: (nextName: string | null) =>
      fetchJson<{ member: MemberDTO }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: nextName }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["session"], { member: data.member });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
      setMessage("Đã cập nhật tên hiển thị.");
      setError(null);
    },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Đang tải hồ sơ…</p>;
  }

  if (!member) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <p className="text-muted-foreground">
          Vui lòng đăng nhập để cập nhật hồ sơ.
        </p>
        <Button asChild className="mt-3" variant="outline">
          <Link href="/">Về trang chủ</Link>
        </Button>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      await saveProfile.mutateAsync(name.trim() || null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không thể cập nhật hồ sơ."
      );
    }
  }

  return (
    <div className="animate-fade-up mx-auto max-w-lg">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Hồ sơ của tôi
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tên hiển thị sẽ xuất hiện khi bạn được giao việc trên các bảng.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-4 rounded-2xl border bg-card p-6 shadow-sm"
      >
        <div className="space-y-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={member.email} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-name">Tên hiển thị</Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ví dụ: Nguyễn An"
            autoComplete="name"
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
            {message}
          </p>
        ) : null}

        <Button type="submit" disabled={saveProfile.isPending}>
          {saveProfile.isPending ? "Đang lưu…" : "Lưu thay đổi"}
        </Button>
      </form>
    </div>
  );
}
