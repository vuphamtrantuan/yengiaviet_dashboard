import { NextResponse } from "next/server";
import { nextPosition } from "@/lib/board";
import {
  type MemberRow,
  buildMemberLookup,
  toCardDTO,
} from "@/lib/supabase";
import {
  ensureBoardExists,
  ensureMemberExists,
  requireSupabaseAndMember,
} from "@/lib/server-auth";

export const dynamic = "force-dynamic";

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  return datePattern.test(trimmed) ? trimmed : null;
}

/** Create a card on a shared board. Assignee may be any workspace member. */
export async function POST(request: Request) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase } = authContext;
  const body = await request.json().catch(() => ({}));
  const listId = typeof body.listId === "string" ? body.listId : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = normalizeOptionalText(body.description);
  const assigneeMemberId =
    typeof body.assigneeMemberId === "string" && body.assigneeMemberId.trim()
      ? body.assigneeMemberId
      : null;
  const startDate = normalizeOptionalDate(body.startDate);
  const dueDate = normalizeOptionalDate(body.dueDate);

  if (!listId || !title) {
    return NextResponse.json(
      { error: "listId và title là bắt buộc." },
      { status: 400 }
    );
  }

  if (body.startDate && !startDate) {
    return NextResponse.json(
      { error: "Ngày bắt đầu phải theo định dạng YYYY-MM-DD." },
      { status: 400 }
    );
  }

  if (body.dueDate && !dueDate) {
    return NextResponse.json(
      { error: "Hạn hoàn thành phải theo định dạng YYYY-MM-DD." },
      { status: 400 }
    );
  }

  if (startDate && dueDate && dueDate < startDate) {
    return NextResponse.json(
      { error: "Hạn hoàn thành không được sớm hơn ngày bắt đầu." },
      { status: 400 }
    );
  }

  const { data: list, error: listError } = await supabase
    .from("lists")
    .select("id, board_id")
    .eq("id", listId)
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

  if (assigneeMemberId) {
    const assigneeError = await ensureMemberExists({
      supabase,
      memberId: assigneeMemberId,
    });
    if (assigneeError) {
      return assigneeError;
    }
  }

  const { data: existingCards, error: existingError } = await supabase
    .from("cards")
    .select("position")
    .eq("list_id", listId)
    .is("archived_at", null);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .insert({
      title,
      description,
      assignee_member_id: assigneeMemberId,
      start_date: startDate,
      due_date: dueDate,
      list_id: listId,
      archived_at: null,
      position: nextPosition(existingCards.map((item) => item.position)),
    })
    .select(
      "id, title, description, assignee_member_id, start_date, due_date, position, list_id, archived_at, created_at, updated_at"
    )
    .single();

  if (cardError || !card) {
    return NextResponse.json(
      { error: cardError?.message ?? "Không thể tạo thẻ công việc." },
      { status: 500 }
    );
  }

  let memberLookup = buildMemberLookup([]);
  if (assigneeMemberId) {
    const { data: assigneeMember } = await supabase
      .from("members")
      .select("id, email, name, created_at, updated_at")
      .eq("id", assigneeMemberId)
      .single();
    if (assigneeMember) {
      memberLookup = buildMemberLookup([assigneeMember as MemberRow]);
    }
  }

  return NextResponse.json(toCardDTO(card, memberLookup), { status: 201 });
}
