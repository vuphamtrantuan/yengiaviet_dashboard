import { NextResponse } from "next/server";
import {
  getSupabaseEnvErrorMessage,
  getSupabaseServerClient,
  toBoardDTO,
  toCardDTO,
  toListDTO,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { boardId: string } }
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: getSupabaseEnvErrorMessage() },
      { status: 500 }
    );
  }

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("id, title, created_at, updated_at")
    .eq("id", params.boardId)
    .single();

  if (boardError || !board) {
    return NextResponse.json({ error: "Không tìm thấy bảng." }, { status: 404 });
  }

  const { data: lists, error: listsError } = await supabase
    .from("lists")
    .select("id, title, position, board_id, created_at, updated_at")
    .eq("board_id", params.boardId)
    .order("position", { ascending: true });

  if (listsError) {
    return NextResponse.json({ error: listsError.message }, { status: 500 });
  }

  const listIds = lists.map((list) => list.id);
  const cardsByListId = new Map<string, ReturnType<typeof toCardDTO>[]>();

  if (listIds.length > 0) {
    const { data: cards, error: cardsError } = await supabase
      .from("cards")
      .select(
        "id, title, description, assignee, start_date, due_date, position, list_id, created_at, updated_at"
      )
      .in("list_id", listIds)
      .order("position", { ascending: true });

    if (cardsError) {
      return NextResponse.json({ error: cardsError.message }, { status: 500 });
    }

    cards.forEach((card) => {
      const mappedCard = toCardDTO(card);
      const listCards = cardsByListId.get(mappedCard.listId) ?? [];
      listCards.push(mappedCard);
      cardsByListId.set(mappedCard.listId, listCards);
    });
  }

  return NextResponse.json(
    toBoardDTO({
      board,
      lists: lists.map((list) =>
        toListDTO({
          list,
          cards: [...(cardsByListId.get(list.id) ?? [])].sort(
            (first, second) => first.position - second.position
          ),
        })
      ),
    })
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: { boardId: string } }
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: getSupabaseEnvErrorMessage() },
      { status: 500 }
    );
  }

  const { error } = await supabase.from("boards").delete().eq("id", params.boardId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
