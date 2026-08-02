import { NextResponse } from "next/server";
import { toBoardSummary, type BoardRow } from "@/lib/supabase";
import { requireSupabaseAndMember } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/**
 * List shared boards. By default returns active boards only.
 * Pass `?archived=1` to list archived boards for the restore panel.
 */
export async function GET(request: Request) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase } = authContext;
  const archivedOnly =
    new URL(request.url).searchParams.get("archived") === "1";

  let query = supabase
    .from("boards")
    .select("id, title, archived_at, created_at, updated_at")
    .order("created_at", { ascending: true });

  query = archivedOnly
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);

  const { data: boards, error: boardsError } = await query;

  if (boardsError) {
    return NextResponse.json({ error: boardsError.message }, { status: 500 });
  }

  if (boards.length === 0) {
    return NextResponse.json([]);
  }

  const boardIds = boards.map((board) => board.id);
  const { data: lists, error: listsError } = await supabase
    .from("lists")
    .select("board_id")
    .in("board_id", boardIds);

  if (listsError) {
    return NextResponse.json({ error: listsError.message }, { status: 500 });
  }

  const listsByBoardId = lists.reduce((acc, list) => {
    acc.set(list.board_id, (acc.get(list.board_id) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());

  return NextResponse.json(
    (boards as BoardRow[]).map((board) =>
      toBoardSummary({
        board,
        listsCount: listsByBoardId.get(board.id) ?? 0,
      })
    )
  );
}

/** Create a shared board visible to every authenticated workspace user. */
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
    .insert({ title, archived_at: null })
    .select("id, title, archived_at, created_at, updated_at")
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

  await supabase.from("board_members").upsert(
    {
      board_id: board.id,
      member_id: member.id,
    },
    { onConflict: "board_id,member_id" }
  );

  return NextResponse.json(
    {
      ...toBoardSummary({ board: board as BoardRow, listsCount: lists.length }),
      lists,
    },
    { status: 201 }
  );
}
