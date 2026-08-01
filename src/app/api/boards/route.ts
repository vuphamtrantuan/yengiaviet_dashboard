import { NextResponse } from "next/server";
import {
  type BoardMemberRow,
  toBoardSummary,
} from "@/lib/supabase";
import { requireSupabaseAndMember } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase, member } = authContext;
  const { data: memberBoards, error: memberBoardsError } = await supabase
    .from("board_members")
    .select("board_id, member_id, created_at")
    .eq("member_id", member.id);

  if (memberBoardsError) {
    return NextResponse.json({ error: memberBoardsError.message }, { status: 500 });
  }

  let effectiveMemberBoards = memberBoards;

  if (effectiveMemberBoards.length === 0) {
    const { data: existingMembership, error: existingMembershipError } = await supabase
      .from("board_members")
      .select("board_id")
      .limit(1);

    if (existingMembershipError) {
      return NextResponse.json({ error: existingMembershipError.message }, { status: 500 });
    }

    if (existingMembership.length === 0) {
      const { data: legacyBoards, error: legacyBoardsError } = await supabase
        .from("boards")
        .select("id");

      if (legacyBoardsError) {
        return NextResponse.json({ error: legacyBoardsError.message }, { status: 500 });
      }

      if (legacyBoards.length > 0) {
        const { error: backfillError } = await supabase.from("board_members").insert(
          legacyBoards.map((board) => ({
            board_id: board.id,
            member_id: member.id,
          }))
        );

        if (backfillError) {
          return NextResponse.json({ error: backfillError.message }, { status: 500 });
        }
      }

      effectiveMemberBoards = legacyBoards.map((board) => ({
        board_id: board.id,
        member_id: member.id,
        created_at: new Date().toISOString(),
      }));
    }
  }

  const boardIds = effectiveMemberBoards.map(
    (item: BoardMemberRow) => item.board_id
  );
  if (boardIds.length === 0) {
    return NextResponse.json([]);
  }

  const { data: boards, error: boardsError } = await supabase
    .from("boards")
    .select("id, title, created_at, updated_at")
    .in("id", boardIds)
    .order("created_at", { ascending: true });

  if (boardsError) {
    return NextResponse.json({ error: boardsError.message }, { status: 500 });
  }

  const matchedBoardIds = boards.map((board) => board.id);
  let listsByBoardId = new Map<string, number>();

  if (matchedBoardIds.length > 0) {
    const { data: lists, error: listsError } = await supabase
      .from("lists")
      .select("board_id")
      .in("board_id", matchedBoardIds);

    if (listsError) {
      return NextResponse.json({ error: listsError.message }, { status: 500 });
    }

    listsByBoardId = lists.reduce((acc, list) => {
      const currentCount = acc.get(list.board_id) ?? 0;
      acc.set(list.board_id, currentCount + 1);
      return acc;
    }, new Map<string, number>());
  }

  return NextResponse.json(
    boards.map((board) =>
      toBoardSummary({
        board,
        listsCount: listsByBoardId.get(board.id) ?? 0,
      })
    )
  );
}

export async function POST(request: Request) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase, member } = authContext;
  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Tên bảng là bắt buộc." }, { status: 400 });
  }

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .insert({ title })
    .select("id, title, created_at, updated_at")
    .single();

  if (boardError || !board) {
    return NextResponse.json(
      { error: boardError?.message ?? "Không thể tạo bảng." },
      { status: 500 }
    );
  }

  const { data: lists, error: listsError } = await supabase
    .from("lists")
    .insert([
      { title: "Việc cần làm", position: 0, board_id: board.id },
      { title: "Đang thực hiện", position: 1, board_id: board.id },
      { title: "Hoàn thành", position: 2, board_id: board.id },
    ])
    .select("id, title, position, board_id, created_at, updated_at");

  if (listsError) {
    await supabase.from("boards").delete().eq("id", board.id);
    return NextResponse.json({ error: listsError.message }, { status: 500 });
  }

  const { error: boardMemberError } = await supabase.from("board_members").insert({
    board_id: board.id,
    member_id: member.id,
  });

  if (boardMemberError) {
    await supabase.from("boards").delete().eq("id", board.id);
    return NextResponse.json({ error: boardMemberError.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      ...toBoardSummary({ board, listsCount: lists.length }),
      lists,
    },
    { status: 201 }
  );
}
