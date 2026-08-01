import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { boardId: string } }
) {
  const board = await prisma.board.findUnique({
    where: { id: params.boardId },
    include: {
      lists: {
        orderBy: { position: "asc" },
        include: { cards: { orderBy: { position: "asc" } } },
      },
    },
  });

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }
  return NextResponse.json(board);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { boardId: string } }
) {
  await prisma.board.delete({ where: { id: params.boardId } });
  return NextResponse.json({ ok: true });
}
