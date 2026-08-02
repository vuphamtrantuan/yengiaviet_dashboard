import { NextResponse } from "next/server";
import { toMemberDTO } from "@/lib/supabase";
import { requireSupabaseAndMember } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/** Update a workspace user's display name. */
export async function PATCH(
  request: Request,
  { params }: { params: { memberId: string } }
) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase } = authContext;
  const body = await request.json().catch(() => ({}));

  if (!("name" in body)) {
    return NextResponse.json(
      { error: "Không có thông tin nào để cập nhật." },
      { status: 400 }
    );
  }

  const name =
    typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;

  const { data: member, error } = await supabase
    .from("members")
    .update({ name })
    .eq("id", params.memberId)
    .select("id, email, name, created_at, updated_at")
    .single();

  if (error || !member) {
    return NextResponse.json(
      { error: error?.message ?? "Không tìm thấy người dùng." },
      { status: error ? 500 : 404 }
    );
  }

  return NextResponse.json(toMemberDTO(member));
}

/**
 * Remove a workspace user. Blocked when deleting the currently logged-in user.
 * Assignees referencing this member are cleared by FK ON DELETE SET NULL.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { memberId: string } }
) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase, member } = authContext;
  if (member.id === params.memberId) {
    return NextResponse.json(
      { error: "Bạn không thể xóa chính tài khoản đang đăng nhập." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("members")
    .delete()
    .eq("id", params.memberId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
