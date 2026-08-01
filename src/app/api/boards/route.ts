import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const boards = await prisma.board.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { lists: true } } },
  });
  return NextResponse.json(boards);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const board = await prisma.board.create({
    data: {
      title,
      // Seed a new board with the classic Kanban columns.
      lists: {
        create: [
          { title: "To Do", position: 0 },
          { title: "In Progress", position: 1 },
          { title: "Done", position: 2 },
        ],
      },
    },
    include: { lists: true },
  });

  return NextResponse.json(board, { status: 201 });
}
