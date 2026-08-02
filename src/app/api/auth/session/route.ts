import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getSupabaseEnvErrorMessage,
  getSupabaseServerClient,
  toMemberDTO,
} from "@/lib/supabase";
import { SESSION_COOKIE_NAME } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/** Return the current workspace member session, or null when logged out. */
export async function GET() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: getSupabaseEnvErrorMessage() },
      { status: 500 }
    );
  }

  const memberId = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!memberId) {
    return NextResponse.json({ member: null });
  }

  const { data: member, error } = await supabase
    .from("members")
    .select("id, email, name, created_at, updated_at")
    .eq("id", memberId)
    .single();

  if (error || !member) {
    if (error?.message?.includes("public.members")) {
      return NextResponse.json(
        {
          error:
            "Cơ sở dữ liệu chưa có bảng members. Vui lòng chạy lại supabase/schema.sql mới nhất.",
        },
        { status: 500 }
      );
    }
    cookies().delete(SESSION_COOKIE_NAME);
    return NextResponse.json({ member: null });
  }

  return NextResponse.json({ member: toMemberDTO(member) });
}
