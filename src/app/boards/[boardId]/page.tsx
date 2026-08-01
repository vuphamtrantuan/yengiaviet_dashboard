import BoardView from "@/components/BoardView";

export const dynamic = "force-dynamic";

export default function BoardPage({ params }: { params: { boardId: string } }) {
  return <BoardView boardId={params.boardId} />;
}
