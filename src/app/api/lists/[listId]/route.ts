import { NextResponse } from "next/server";
import { ensureBoardMembership, requireSupabaseAndMember } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { listId: string } }
) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase, member } = authContext;
  const { data: list, error: listError } = await supabase
    .from("lists")
    .select("id, board_id")
    .eq("id", params.listId)
    .single();

  if (listError || !list) {
    return NextResponse.json({ error: "Không tìm thấy danh sách." }, { status: 404 });
  }

  const boardMembershipError = await ensureBoardMembership({
    supabase,
    boardId: list.board_id,
    memberId: member.id,
  });
  if (boardMembershipError) {
    return boardMembershipError;
  }

  const { error } = await supabase.from("lists").delete().eq("id", params.listId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
