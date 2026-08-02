import { NextResponse } from "next/server";
import {
  type BoardRow,
  type CardRow,
  type ListRow,
  type MemberRow,
  buildMemberLookup,
  toBoardDTO,
  toBoardSummary,
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
        archived_at,
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

  const board: BoardRow = {
    id: boardResult.data.id,
    title: boardResult.data.title,
    archived_at: boardResult.data.archived_at ?? null,
    created_at: boardResult.data.created_at,
    updated_at: boardResult.data.updated_at,
  };

  return NextResponse.json(
    toBoardDTO({
      board,
      lists,
      members: members.map((item) => toMemberDTO(item)),
    })
  );
}

/**
 * Rename a board and/or archive/restore it.
 * Body: `{ title?: string, archived?: boolean }`
 */
export async function PATCH(
  request: Request,
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

  const body = await request.json().catch(() => ({}));
  const data: { title?: string; archived_at?: string | null } = {};

  if ("title" in body) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json(
        { error: "Tên bảng không được để trống." },
        { status: 400 }
      );
    }
    data.title = body.title.trim();
  }

  if ("archived" in body) {
    if (typeof body.archived !== "boolean") {
      return NextResponse.json(
        { error: "archived phải là boolean." },
        { status: 400 }
      );
    }
    data.archived_at = body.archived ? new Date().toISOString() : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Không có thông tin nào để cập nhật." },
      { status: 400 }
    );
  }

  const { data: board, error } = await supabase
    .from("boards")
    .update(data)
    .eq("id", params.boardId)
    .select("id, title, archived_at, created_at, updated_at")
    .single();

  if (error || !board) {
    return NextResponse.json(
      { error: error?.message ?? "Không thể cập nhật bảng." },
      { status: 500 }
    );
  }

  const { count, error: countError } = await supabase
    .from("lists")
    .select("id", { count: "exact", head: true })
    .eq("board_id", params.boardId);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  return NextResponse.json(
    toBoardSummary({
      board: board as BoardRow,
      listsCount: count ?? 0,
    })
  );
}

/** Permanently delete a shared board. Prefer archive for soft-removal UX. */
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
