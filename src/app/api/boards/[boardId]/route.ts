import { NextResponse } from "next/server";
import {
  type CardRow,
  type ListRow,
  type MemberRow,
  buildMemberLookup,
  toBoardDTO,
  toCardDTO,
  toListDTO,
  toMemberDTO,
} from "@/lib/supabase";
import { ensureBoardExists, requireSupabaseAndMember } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

type NestedCard = CardRow;
type NestedList = ListRow & { cards?: NestedCard[] | null };

/**
 * Fetch a shared board with lists, active (non-archived) cards, and all
 * workspace members. Nested select reduces round-trips vs. sequential queries.
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

  const [boardResult, membersResult] = await Promise.all([
    supabase
      .from("boards")
      .select(
        `
        id,
        title,
        created_at,
        updated_at,
        lists (
          id,
          title,
          position,
          board_id,
          created_at,
          updated_at,
          cards (
            id,
            title,
            description,
            assignee_member_id,
            start_date,
            due_date,
            position,
            list_id,
            archived_at,
            created_at,
            updated_at
          )
        )
      `
      )
      .eq("id", params.boardId)
      .is("lists.cards.archived_at", null)
      .order("position", { referencedTable: "lists", ascending: true })
      .order("position", { referencedTable: "lists.cards", ascending: true })
      .single(),
    supabase
      .from("members")
      .select("id, email, name, created_at, updated_at")
      .order("email", { ascending: true }),
  ]);

  if (boardResult.error || !boardResult.data) {
    return NextResponse.json({ error: "Không tìm thấy bảng." }, { status: 404 });
  }

  if (membersResult.error) {
    return NextResponse.json(
      { error: membersResult.error.message },
      { status: 500 }
    );
  }

  const members = membersResult.data as MemberRow[];
  const memberLookup = buildMemberLookup(members);
  const nestedLists = (boardResult.data.lists ?? []) as NestedList[];

  const lists = nestedLists
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((list) =>
      toListDTO({
        list,
        cards: (list.cards ?? [])
          .filter((card) => !card.archived_at)
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((card) => toCardDTO(card, memberLookup)),
      })
    );

  return NextResponse.json(
    toBoardDTO({
      board: {
        id: boardResult.data.id,
        title: boardResult.data.title,
        created_at: boardResult.data.created_at,
        updated_at: boardResult.data.updated_at,
      },
      lists,
      members: members.map((item) => toMemberDTO(item)),
    })
  );
}

/** Delete a shared board. Any authenticated user may delete. */
export async function DELETE(
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

  const { error } = await supabase.from("boards").delete().eq("id", params.boardId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
