"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api-client";
import type { MemberDTO } from "@/lib/types";

const SESSION_KEY = ["session"] as const;

/** Load the current member session with shared cache across pages. */
export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: () =>
      fetchJson<{ member: MemberDTO | null }>("/api/auth/session", {
        cache: "no-store",
      }),
  });
}

/** Email login mutation that updates the session cache on success. */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      fetchJson<{ member: MemberDTO }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(SESSION_KEY, { member: data.member });
    },
  });
}

/** Logout mutation that clears the session cache. */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson<{ ok?: boolean }>("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.setQueryData(SESSION_KEY, { member: null });
      queryClient.removeQueries({ queryKey: ["boards"] });
      queryClient.removeQueries({ queryKey: ["board"] });
      queryClient.removeQueries({ queryKey: ["members"] });
    },
  });
}
