import { NextResponse } from "next/server";
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

/** Update card fields on a shared board. */
export async function PATCH(
  request: Request,
  { params }: { params: { cardId: string } }
) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase } = authContext;
  const body = await request.json().catch(() => ({}));
  const { data: existingCard, error: existingCardError } = await supabase
    .from("cards")
    .select("id, list_id, start_date, due_date, assignee_member_id, archived_at")
    .eq("id", params.cardId)
    .single();

  if (existingCardError || !existingCard) {
    return NextResponse.json({ error: "Không tìm thấy thẻ công việc." }, { status: 404 });
  }

  const { data: sourceList, error: sourceListError } = await supabase
    .from("lists")
    .select("id, board_id")
    .eq("id", existingCard.list_id)
    .single();

  if (sourceListError || !sourceList) {
    return NextResponse.json(
      { error: "Không thể xác định danh sách của thẻ công việc." },
      { status: 500 }
    );
  }

  const boardExistsError = await ensureBoardExists({
    supabase,
    boardId: sourceList.board_id,
  });
  if (boardExistsError) {
    return boardExistsError;
  }

  const data: {
    title?: string;
    description?: string | null;
    assignee_member_id?: string | null;
    start_date?: string | null;
    due_date?: string | null;
  } = {};

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "Tiêu đề không được để trống." }, { status: 400 });
    }
    data.title = title;
  }

  if ("description" in body) {
    data.description = normalizeOptionalText(body.description);
  }

  if ("assigneeMemberId" in body) {
    if (body.assigneeMemberId === null || body.assigneeMemberId === "") {
      data.assignee_member_id = null;
    } else if (typeof body.assigneeMemberId === "string") {
      const assigneeError = await ensureMemberExists({
        supabase,
        memberId: body.assigneeMemberId,
      });
      if (assigneeError) {
        return assigneeError;
      }
      data.assignee_member_id = body.assigneeMemberId;
    } else {
      return NextResponse.json(
        { error: "assigneeMemberId không hợp lệ." },
        { status: 400 }
      );
    }
  }

  const parsedStartDate = normalizeOptionalDate(body.startDate);
  if ("startDate" in body) {
    if (body.startDate && !parsedStartDate) {
      return NextResponse.json(
        { error: "Ngày bắt đầu phải theo định dạng YYYY-MM-DD." },
        { status: 400 }
      );
    }
    data.start_date = parsedStartDate;
  }

  const parsedDueDate = normalizeOptionalDate(body.dueDate);
  if ("dueDate" in body) {
    if (body.dueDate && !parsedDueDate) {
      return NextResponse.json(
        { error: "Hạn hoàn thành phải theo định dạng YYYY-MM-DD." },
        { status: 400 }
      );
    }
    data.due_date = parsedDueDate;
  }

  const effectiveStartDate =
    data.start_date !== undefined ? data.start_date : existingCard.start_date;
  const effectiveDueDate =
    data.due_date !== undefined ? data.due_date : existingCard.due_date;

  if (effectiveStartDate && effectiveDueDate && effectiveDueDate < effectiveStartDate) {
    return NextResponse.json(
      { error: "Hạn hoàn thành không được sớm hơn ngày bắt đầu." },
      { status: 400 }
    );
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Không có thông tin nào để cập nhật." },
      { status: 400 }
    );
  }

  const { data: card, error } = await supabase
    .from("cards")
    .update(data)
    .eq("id", params.cardId)
    .select(
      "id, title, description, assignee_member_id, start_date, due_date, position, list_id, archived_at, created_at, updated_at"
    )
    .single();

  if (error || !card) {
    return NextResponse.json(
      { error: error?.message ?? "Không thể cập nhật thẻ công việc." },
      { status: 500 }
    );
  }

  let memberLookup = buildMemberLookup([]);
  if (card.assignee_member_id) {
    const { data: assigneeMember } = await supabase
      .from("members")
      .select("id, email, name, created_at, updated_at")
      .eq("id", card.assignee_member_id)
      .single();
    if (assigneeMember) {
      memberLookup = buildMemberLookup([assigneeMember as MemberRow]);
    }
  }

  return NextResponse.json(toCardDTO(card, memberLookup));
}

/** Permanently delete a card. Prefer archive for soft-removal UX. */
export async function DELETE(
  _request: Request,
  { params }: { params: { cardId: string } }
) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase } = authContext;
  const { data: existingCard, error: existingCardError } = await supabase
    .from("cards")
    .select("id, list_id")
    .eq("id", params.cardId)
    .single();

  if (existingCardError || !existingCard) {
    return NextResponse.json({ error: "Không tìm thấy thẻ công việc." }, { status: 404 });
  }

  const { data: sourceList, error: sourceListError } = await supabase
    .from("lists")
    .select("id, board_id")
    .eq("id", existingCard.list_id)
    .single();

  if (sourceListError || !sourceList) {
    return NextResponse.json(
      { error: "Không thể xác định danh sách của thẻ công việc." },
      { status: 500 }
    );
  }

  const boardExistsError = await ensureBoardExists({
    supabase,
    boardId: sourceList.board_id,
  });
  if (boardExistsError) {
    return boardExistsError;
  }

  const { error } = await supabase.from("cards").delete().eq("id", params.cardId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
