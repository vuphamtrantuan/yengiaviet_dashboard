import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeMove } from "@/lib/board";

export const dynamic = "force-dynamic";

/**
 * Move a card to a destination list at a given index, recomputing dense
 * sequential positions for every affected list inside a transaction.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { cardId: string } }
) {
  const body = await request.json().catch(() => ({}));
  const destListId = typeof body.destListId === "string" ? body.destListId : "";
  const destIndex =
    typeof body.destIndex === "number" && body.destIndex >= 0 ? body.destIndex : 0;

  if (!destListId) {
    return NextResponse.json({ error: "destListId is required" }, { status: 400 });
  }

  const card = await prisma.card.findUnique({ where: { id: params.cardId } });
  if (!card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const sourceListId = card.listId;
  const sameList = sourceListId === destListId;

  const [sourceCards, destCards] = await Promise.all([
    prisma.card.findMany({
      where: { listId: sourceListId },
      orderBy: { position: "asc" },
      select: { id: true },
    }),
    sameList
      ? Promise.resolve([])
      : prisma.card.findMany({
          where: { listId: destListId },
          orderBy: { position: "asc" },
          select: { id: true },
        }),
  ]);

  const { sourceOrder, destOrder } = computeMove({
    cardId: params.cardId,
    sourceOrder: sourceCards.map((c) => c.id),
    destOrder: sameList ? sourceCards.map((c) => c.id) : destCards.map((c) => c.id),
    sameList,
    destIndex,
  });

  await prisma.$transaction([
    prisma.card.update({
      where: { id: params.cardId },
      data: { listId: destListId },
    }),
    ...sourceOrder.map((id, index) =>
      prisma.card.update({ where: { id }, data: { position: index } })
    ),
    ...(sameList
      ? []
      : destOrder.map((id, index) =>
          prisma.card.update({ where: { id }, data: { position: index } })
        )),
  ]);

  return NextResponse.json({ ok: true });
}
