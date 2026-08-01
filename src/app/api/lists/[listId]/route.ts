import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { listId: string } }
) {
  await prisma.list.delete({ where: { id: params.listId } });
  return NextResponse.json({ ok: true });
}
