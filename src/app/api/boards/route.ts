import { NextResponse } from "next/server";
import {
  getSupabaseEnvErrorMessage,
  getSupabaseServerClient,
  toBoardSummary,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: getSupabaseEnvErrorMessage() },
      { status: 500 }
    );
  }

  const { data: boards, error: boardsError } = await supabase
    .from("boards")
    .select("id, title, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (boardsError) {
    return NextResponse.json({ error: boardsError.message }, { status: 500 });
  }

  const boardIds = boards.map((board) => board.id);
  let listsByBoardId = new Map<string, number>();

  if (boardIds.length > 0) {
    const { data: lists, error: listsError } = await supabase
      .from("lists")
      .select("board_id")
      .in("board_id", boardIds);

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
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: getSupabaseEnvErrorMessage() },
      { status: 500 }
    );
  }

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

  return NextResponse.json(
    {
      ...toBoardSummary({ board, listsCount: lists.length }),
      lists,
    },
    { status: 201 }
  );
}
