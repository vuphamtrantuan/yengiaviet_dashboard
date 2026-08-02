import { NextResponse } from "next/server";
import {
  type MemberRow,
  buildMemberLookup,
  toCardDTO,
} from "@/lib/supabase";
import { ensureBoardExists, requireSupabaseAndMember } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/**
 * Soft-archive or restore a card. Archived cards are excluded from the main
 * board fetch and loaded via the dedicated archived endpoint.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { cardId: string } }
) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase } = authContext;
  const body = await request.json().catch(() => ({}));
  const archived = body.archived === true;

  const { data: existingCard, error: existingCardError } = await supabase
    .from("cards")
    .select("id, list_id, archived_at")
    .eq("id", params.cardId)
    .single();

  if (existingCardError || !existingCard) {
    return NextResponse.json({ error: "Không tìm thấy thẻ công việc." }, { status: 404 });
  }

  const { data: sourceList, error: sourceListError } = await supabase
    .from("lists")
    .select("id, board_id")
    .eq("id", existingCard.list_id)
    .single();

  if (sourceListError || !sourceList) {
    return NextResponse.json(
      { error: "Không thể xác định danh sách của thẻ công việc." },
      { status: 500 }
    );
  }

  const boardExistsError = await ensureBoardExists({
    supabase,
    boardId: sourceList.board_id,
  });
  if (boardExistsError) {
    return boardExistsError;
  }

  const { data: card, error } = await supabase
    .from("cards")
    .update({
      archived_at: archived ? new Date().toISOString() : null,
    })
    .eq("id", params.cardId)
    .select(
      "id, title, description, assignee_member_id, start_date, due_date, position, list_id, archived_at, created_at, updated_at"
    )
    .single();

  if (error || !card) {
    return NextResponse.json(
      { error: error?.message ?? "Không thể cập nhật trạng thái lưu trữ." },
      { status: 500 }
    );
  }

  let memberLookup = buildMemberLookup([]);
  if (card.assignee_member_id) {
    const { data: assigneeMember } = await supabase
      .from("members")
      .select("id, email, name, created_at, updated_at")
      .eq("id", card.assignee_member_id)
      .single();
    if (assigneeMember) {
      memberLookup = buildMemberLookup([assigneeMember as MemberRow]);
    }
  }

  return NextResponse.json(toCardDTO(card, memberLookup));
}
