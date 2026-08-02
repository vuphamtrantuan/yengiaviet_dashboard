import { NextResponse } from "next/server";
import { toListDTO } from "@/lib/supabase";
import { ensureBoardExists, requireSupabaseAndMember } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/** Rename a list on a shared board. */
export async function PATCH(
  request: Request,
  { params }: { params: { listId: string } }
) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase } = authContext;
  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";

  if (!title) {
    return NextResponse.json(
      { error: "Tên danh sách không được để trống." },
      { status: 400 }
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("lists")
    .select("id, board_id")
    .eq("id", params.listId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: "Không tìm thấy danh sách." }, { status: 404 });
  }

  const boardExistsError = await ensureBoardExists({
    supabase,
    boardId: existing.board_id,
  });
  if (boardExistsError) {
    return boardExistsError;
  }

  const { data: list, error } = await supabase
    .from("lists")
    .update({ title })
    .eq("id", params.listId)
    .select("id, title, position, board_id, created_at, updated_at")
    .single();

  if (error || !list) {
    return NextResponse.json(
      { error: error?.message ?? "Không thể đổi tên danh sách." },
      { status: 500 }
    );
  }

  return NextResponse.json(toListDTO({ list, cards: [] }));
}

/**
 * Delete a list from a shared board.
 * Only allowed when the list has no active (non-archived) cards.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { listId: string } }
) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase } = authContext;
  const { data: list, error: listError } = await supabase
    .from("lists")
    .select("id, board_id")
    .eq("id", params.listId)
    .single();

  if (listError || !list) {
    return NextResponse.json({ error: "Không tìm thấy danh sách." }, { status: 404 });
  }

  const boardExistsError = await ensureBoardExists({
    supabase,
    boardId: list.board_id,
  });
  if (boardExistsError) {
    return boardExistsError;
  }

  const { count, error: countError } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("list_id", params.listId)
    .is("archived_at", null);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "Chỉ có thể xóa danh sách khi không còn thẻ công việc nào bên trong.",
      },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("lists").delete().eq("id", params.listId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
