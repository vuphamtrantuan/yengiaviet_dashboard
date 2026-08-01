import { NextResponse } from "next/server";
import { nextPosition } from "@/lib/board";
import {
  getSupabaseEnvErrorMessage,
  getSupabaseServerClient,
  toCardDTO,
} from "@/lib/supabase";

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

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: getSupabaseEnvErrorMessage() },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const listId = typeof body.listId === "string" ? body.listId : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = normalizeOptionalText(body.description);
  const assignee = normalizeOptionalText(body.assignee);
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

  const { data: existingCards, error: existingError } = await supabase
    .from("cards")
    .select("position")
    .eq("list_id", listId);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .insert({
      title,
      description,
      assignee,
      start_date: startDate,
      due_date: dueDate,
      list_id: listId,
      position: nextPosition(existingCards.map((card) => card.position)),
    })
    .select(
      "id, title, description, assignee, start_date, due_date, position, list_id, created_at, updated_at"
    )
    .single();

  if (cardError || !card) {
    return NextResponse.json(
      { error: cardError?.message ?? "Không thể tạo thẻ công việc." },
      { status: 500 }
    );
  }

  return NextResponse.json(toCardDTO(card), { status: 201 });
}
