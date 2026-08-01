import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextPosition } from "@/lib/board";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const boardId = typeof body.boardId === "string" ? body.boardId : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";

  if (!boardId || !title) {
    return NextResponse.json(
      { error: "boardId and title are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.list.findMany({
    where: { boardId },
    select: { position: true },
  });

  const list = await prisma.list.create({
    data: {
      title,
      boardId,
      position: nextPosition(existing.map((l) => l.position)),
    },
    include: { cards: true },
  });

  return NextResponse.json(list, { status: 201 });
}
