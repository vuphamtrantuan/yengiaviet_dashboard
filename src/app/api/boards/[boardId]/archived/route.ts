import { NextResponse } from "next/server";
import type { ArchivedCardDTO } from "@/lib/types";
import {
  type CardRow,
  type MemberRow,
  buildMemberLookup,
  toCardDTO,
} from "@/lib/supabase";
import { ensureBoardExists, requireSupabaseAndMember } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/**
 * Fetch archived cards for a board in a dedicated request so the main board
 * payload stays light. Used when the user opens the archive panel.
 */
export async function GET(
  _request: Request,
  { params }: { params: { boardId: string } }
) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase } = authContext;
  const boardExistsError = await ensureBoardExists({
    supabase,
    boardId: params.boardId,
  });
  if (boardExistsError) {
    return boardExistsError;
  }

  const { data: lists, error: listsError } = await supabase
    .from("lists")
    .select("id, title")
    .eq("board_id", params.boardId);

  if (listsError) {
    return NextResponse.json({ error: listsError.message }, { status: 500 });
  }

  if (lists.length === 0) {
    return NextResponse.json([] satisfies ArchivedCardDTO[]);
  }

  const listTitleById = new Map(lists.map((list) => [list.id, list.title]));
  const listIds = lists.map((list) => list.id);

  const [cardsResult, membersResult] = await Promise.all([
    supabase
      .from("cards")
      .select(
        "id, title, description, assignee_member_id, start_date, due_date, position, list_id, archived_at, created_at, updated_at"
      )
      .in("list_id", listIds)
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false }),
    supabase.from("members").select("id, email, name, created_at, updated_at"),
  ]);

  if (cardsResult.error) {
    return NextResponse.json({ error: cardsResult.error.message }, { status: 500 });
  }

  if (membersResult.error) {
    return NextResponse.json(
      { error: membersResult.error.message },
      { status: 500 }
    );
  }

  const memberLookup = buildMemberLookup(membersResult.data as MemberRow[]);
  const archivedCards: ArchivedCardDTO[] = (cardsResult.data as CardRow[]).map(
    (card) => ({
      ...toCardDTO(card, memberLookup),
      listTitle: listTitleById.get(card.list_id) ?? "Danh sách",
    })
  );

  return NextResponse.json(archivedCards);
}
