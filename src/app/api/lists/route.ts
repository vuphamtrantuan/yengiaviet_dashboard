import { NextResponse } from "next/server";
import { nextPosition } from "@/lib/board";
import { toListDTO } from "@/lib/supabase";
import { ensureBoardMembership, requireSupabaseAndMember } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase, member } = authContext;
  const body = await request.json().catch(() => ({}));
  const boardId = typeof body.boardId === "string" ? body.boardId : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";

  if (!boardId || !title) {
    return NextResponse.json(
      { error: "boardId và title là bắt buộc." },
      { status: 400 }
    );
  }

  const boardMembershipError = await ensureBoardMembership({
    supabase,
    boardId,
    memberId: member.id,
  });
  if (boardMembershipError) {
    return boardMembershipError;
  }

  const { data: existingLists, error: existingError } = await supabase
    .from("lists")
    .select("position")
    .eq("board_id", boardId);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const { data: list, error: listError } = await supabase
    .from("lists")
    .insert({
      title,
      board_id: boardId,
      position: nextPosition(existingLists.map((list) => list.position)),
    })
    .select("id, title, position, board_id, created_at, updated_at")
    .single();

  if (listError || !list) {
    return NextResponse.json(
      { error: listError?.message ?? "Không thể tạo danh sách." },
      { status: 500 }
    );
  }

  return NextResponse.json(toListDTO({ list, cards: [] }), { status: 201 });
}
