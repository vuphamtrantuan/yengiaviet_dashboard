import { NextResponse } from "next/server";
import { computeMove } from "@/lib/board";
import {
  getSupabaseEnvErrorMessage,
  getSupabaseServerClient,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Move a card to a destination list at a given index, recomputing dense
 * sequential positions for every affected list inside a transaction.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { cardId: string } }
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: getSupabaseEnvErrorMessage() },
      { status: 500 }
    );
  }

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
