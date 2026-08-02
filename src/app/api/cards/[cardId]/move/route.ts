import { NextResponse } from "next/server";
import { computeMove } from "@/lib/board";
import { ensureBoardExists, requireSupabaseAndMember } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/**
 * Move a card within/across lists. Only active (non-archived) cards participate
 * in position recomputation for safer concurrent board edits.
 *
 * The moved card gets `list_id` + final `position` in one write so cross-list
 * drops do not briefly land at a stale index.
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
  const destListId = typeof body.destListId === "string" ? body.destListId : "";
  const destIndex =
    typeof body.destIndex === "number" && body.destIndex >= 0 ? body.destIndex : 0;

  if (!destListId) {
    return NextResponse.json({ error: "destListId là bắt buộc." }, { status: 400 });
  }

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, list_id, archived_at")
    .eq("id", params.cardId)
    .single();

  if (cardError || !card) {
    return NextResponse.json({ error: "Không tìm thấy thẻ công việc." }, { status: 404 });
  }

  if (card.archived_at) {
    return NextResponse.json(
      { error: "Không thể di chuyển thẻ đã lưu trữ. Hãy khôi phục trước." },
      { status: 400 }
    );
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

  const boardExistsError = await ensureBoardExists({
    supabase,
    boardId: sourceList.board_id,
  });
  if (boardExistsError) {
    return boardExistsError;
  }

  const sourceListId = card.list_id;
  const sameList = sourceListId === destListId;

  const { data: sourceCards, error: sourceError } = await supabase
    .from("cards")
    .select("id")
    .eq("list_id", sourceListId)
    .is("archived_at", null)
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
      .is("archived_at", null)
      .order("position", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    destCards = data;
  }

  const { sourceOrder, destOrder } = computeMove({
    cardId: params.cardId,
    sourceOrder: sourceCards.map((item) => item.id),
    destOrder: sameList
      ? sourceCards.map((item) => item.id)
      : destCards.map((item) => item.id),
    sameList,
    destIndex,
  });

  const finalOrder = sameList ? sourceOrder : destOrder;
  const movedPosition = finalOrder.indexOf(params.cardId);
  if (movedPosition < 0) {
    return NextResponse.json(
      { error: "Không thể tính vị trí thẻ sau khi di chuyển." },
      { status: 500 }
    );
  }

  const { error: moveError } = await supabase
    .from("cards")
    .update({
      list_id: destListId,
      position: movedPosition,
    })
    .eq("id", params.cardId);

  if (moveError) {
    return NextResponse.json({ error: moveError.message }, { status: 500 });
  }

  const siblingUpdates = (sameList ? sourceOrder : [...sourceOrder, ...destOrder])
    .filter((id) => id !== params.cardId)
    .map((id) => {
      const order = sameList
        ? sourceOrder
        : sourceOrder.includes(id)
          ? sourceOrder
          : destOrder;
      return { id, position: order.indexOf(id) };
    })
    .filter((update) => update.position >= 0);

  const results = await Promise.all(
    siblingUpdates.map((update) =>
      supabase.from("cards").update({ position: update.position }).eq("id", update.id)
    )
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    destListId,
    destIndex: movedPosition,
  });
}
