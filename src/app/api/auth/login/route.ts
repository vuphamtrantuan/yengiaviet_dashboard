import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getSupabaseEnvErrorMessage,
  getSupabaseServerClient,
  toMemberDTO,
} from "@/lib/supabase";
import {
  SESSION_COOKIE_NAME,
  isValidEmail,
  normalizeEmail,
} from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/** Email-only login: upsert workspace member and set session cookie. */
export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: getSupabaseEnvErrorMessage() },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);

  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Email không hợp lệ." },
      { status: 400 }
    );
  }

  const { data: member, error } = await supabase
    .from("members")
    .upsert({ email }, { onConflict: "email" })
    .select("id, email, name, created_at, updated_at")
    .single();

  if (error || !member) {
    const message = error?.message?.includes("public.members")
      ? "Cơ sở dữ liệu chưa có bảng members. Vui lòng chạy lại supabase/schema.sql mới nhất."
      : error?.message ?? "Không thể đăng nhập.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  cookies().set(SESSION_COOKIE_NAME, member.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ member: toMemberDTO(member) });
}
