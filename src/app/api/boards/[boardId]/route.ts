import { NextResponse } from "next/server";
import {
  type BoardMemberRow,
  type MemberRow,
  toBoardDTO,
  toCardDTO,
  toListDTO,
  toMemberDTO,
} from "@/lib/supabase";
import { ensureBoardMembership, requireSupabaseAndMember } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { boardId: string } }
) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase, member } = authContext;
  const boardMembershipError = await ensureBoardMembership({
    supabase,
    boardId: params.boardId,
    memberId: member.id,
  });
  if (boardMembershipError) {
    return boardMembershipError;
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

  const { data: boardMembers, error: boardMembersError } = await supabase
    .from("board_members")
    .select("board_id, member_id, created_at")
    .eq("board_id", params.boardId);

  if (boardMembersError) {
    return NextResponse.json({ error: boardMembersError.message }, { status: 500 });
  }

  const memberIds = boardMembers.map(
    (boardMember: BoardMemberRow) => boardMember.member_id
  );
  const { data: members, error: membersError } =
    memberIds.length === 0
      ? { data: [] as MemberRow[], error: null }
      : await supabase
          .from("members")
          .select("id, email, created_at, updated_at")
          .in("id", memberIds);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  const memberEmailById = new Map<string, string>(
    members.map((item: MemberRow) => [item.id, item.email])
  );
  const listIds = lists.map((list) => list.id);
  const cardsByListId = new Map<string, ReturnType<typeof toCardDTO>[]>();

  if (listIds.length > 0) {
    const { data: cards, error: cardsError } = await supabase
      .from("cards")
      .select(
        "id, title, description, assignee_member_id, start_date, due_date, position, list_id, created_at, updated_at"
      )
      .in("list_id", listIds)
      .order("position", { ascending: true });

    if (cardsError) {
      return NextResponse.json({ error: cardsError.message }, { status: 500 });
    }

    cards.forEach((card) => {
      const mappedCard = toCardDTO(card, memberEmailById);
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
      members: members.map((item) => toMemberDTO(item)),
    })
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: { boardId: string } }
) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase, member } = authContext;
  const boardMembershipError = await ensureBoardMembership({
    supabase,
    boardId: params.boardId,
    memberId: member.id,
  });
  if (boardMembershipError) {
    return boardMembershipError;
  }

  const { error } = await supabase.from("boards").delete().eq("id", params.boardId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
