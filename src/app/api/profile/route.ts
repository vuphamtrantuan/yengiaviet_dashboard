import { NextResponse } from "next/server";
import { toMemberDTO } from "@/lib/supabase";
import { requireSupabaseAndMember } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/** Return the current user's profile. */
export async function GET() {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  return NextResponse.json({ member: toMemberDTO(authContext.member) });
}

/** Update the current user's display name. */
export async function PATCH(request: Request) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase, member } = authContext;
  const body = await request.json().catch(() => ({}));

  if (!("name" in body)) {
    return NextResponse.json(
      { error: "Không có thông tin nào để cập nhật." },
      { status: 400 }
    );
  }

  const name =
    typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;

  const { data: updated, error } = await supabase
    .from("members")
    .update({ name })
    .eq("id", member.id)
    .select("id, email, name, created_at, updated_at")
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "Không thể cập nhật hồ sơ." },
      { status: 500 }
    );
  }

  return NextResponse.json({ member: toMemberDTO(updated) });
}
