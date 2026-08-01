import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextPosition } from "@/lib/board";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const listId = typeof body.listId === "string" ? body.listId : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : null;

  if (!listId || !title) {
    return NextResponse.json(
      { error: "listId and title are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.card.findMany({
    where: { listId },
    select: { position: true },
  });

  const card = await prisma.card.create({
    data: {
      title,
      description: description || null,
      listId,
      position: nextPosition(existing.map((c) => c.position)),
    },
  });

  return NextResponse.json(card, { status: 201 });
}
