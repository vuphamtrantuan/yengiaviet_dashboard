import { NextResponse } from "next/server";
import { computeMove } from "@/lib/board";
import { ensureBoardMembership, requireSupabaseAndMember } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/**
 * Move a card to a destination list at a given index, recomputing dense
 * sequential positions for every affected list inside a transaction.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { cardId: string } }
) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase, member } = authContext;
  const body = await request.json().catch(() => ({}));
  const destListId = typeof body.destListId === "string" ? body.destListId : "";
  const destIndex =
    typeof body.destIndex === "number" && body.destIndex >= 0 ? body.destIndex : 0;

  if (!destListId) {
    return NextResponse.json({ error: "destListId là bắt buộc." }, { status: 400 });
  }

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, list_id")
    .eq("id", params.cardId)
    .single();

  if (cardError || !card) {
    return NextResponse.json({ error: "Không tìm thấy thẻ công việc." }, { status: 404 });
  }

  const { data: sourceList, error: sourceListError } = await supabase
    .from("lists")
    .select("id, board_id")
    .eq("id", card.list_id)
    .single();

  if (sourceListError || !sourceList) {
    return NextResponse.json(
      { error: "Không thể xác định danh sách nguồn." },
      { status: 500 }
    );
  }

  const { data: destinationList, error: destinationListError } = await supabase
    .from("lists")
    .select("id, board_id")
    .eq("id", destListId)
    .single();

  if (destinationListError || !destinationList) {
    return NextResponse.json(
      { error: "Không tìm thấy danh sách đích." },
      { status: 404 }
    );
  }

  if (sourceList.board_id !== destinationList.board_id) {
    return NextResponse.json(
      { error: "Không thể di chuyển thẻ giữa hai bảng khác nhau." },
      { status: 400 }
    );
  }

  const boardMembershipError = await ensureBoardMembership({
    supabase,
    boardId: sourceList.board_id,
    memberId: member.id,
  });
  if (boardMembershipError) {
    return boardMembershipError;
  }

  const sourceListId = card.list_id;
  const sameList = sourceListId === destListId;

  const { data: sourceCards, error: sourceError } = await supabase
    .from("cards")
    .select("id")
    .eq("list_id", sourceListId)
    .order("position", { ascending: true });

  if (sourceError) {
    return NextResponse.json({ error: sourceError.message }, { status: 500 });
  }

  let destCards: { id: string }[] = [];
  if (!sameList) {
    const { data, error } = await supabase
      .from("cards")
      .select("id")
      .eq("list_id", destListId)
      .order("position", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    destCards = data;
  }

  const { sourceOrder, destOrder } = computeMove({
    cardId: params.cardId,
    sourceOrder: sourceCards.map((c) => c.id),
    destOrder: sameList ? sourceCards.map((c) => c.id) : destCards.map((c) => c.id),
    sameList,
    destIndex,
  });

  if (!sameList) {
    const { error } = await supabase
      .from("cards")
      .update({ list_id: destListId })
      .eq("id", params.cardId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  for (let index = 0; index < sourceOrder.length; index += 1) {
    const id = sourceOrder[index];
    const { error } = await supabase
      .from("cards")
      .update({ position: index })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (!sameList) {
    for (let index = 0; index < destOrder.length; index += 1) {
      const id = destOrder[index];
      const { error } = await supabase
        .from("cards")
        .update({ position: index })
        .eq("id", id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
