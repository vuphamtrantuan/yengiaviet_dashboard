import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { cardId: string } }
) {
  const body = await request.json().catch(() => ({}));
  const data: { title?: string; description?: string | null } = {};

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    data.title = title;
  }
  if (typeof body.description === "string") {
    data.description = body.description.trim() || null;
  }

  const card = await prisma.card.update({
    where: { id: params.cardId },
    data,
  });
  return NextResponse.json(card);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { cardId: string } }
) {
  await prisma.card.delete({ where: { id: params.cardId } });
  return NextResponse.json({ ok: true });
}
