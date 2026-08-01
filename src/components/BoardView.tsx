"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import type { BoardDTO, CardDTO, ListDTO } from "@/lib/types";
import { computeMove } from "@/lib/board";

export default function BoardView({ boardId }: { boardId: string }) {
  const [board, setBoard] = useState<BoardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    const res = await fetch(`/api/boards/${boardId}`, { cache: "no-store" });
    if (!res.ok) {
      setError("Board not found");
      setLoading(false);
      return;
    }
    setBoard((await res.json()) as BoardDTO);
    setLoading(false);
  }, [boardId]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  function updateListCards(listId: string, cards: CardDTO[]) {
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            lists: prev.lists.map((l) =>
              l.id === listId ? { ...l, cards } : l
            ),
          }
        : prev
    );
  }

  async function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination || !board) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const sourceList = board.lists.find((l) => l.id === source.droppableId);
    const destList = board.lists.find((l) => l.id === destination.droppableId);
    if (!sourceList || !destList) return;

    const sameList = sourceList.id === destList.id;
    const { sourceOrder, destOrder } = computeMove({
      cardId: draggableId,
      sourceOrder: sourceList.cards.map((c) => c.id),
      destOrder: destList.cards.map((c) => c.id),
      sameList,
      destIndex: destination.index,
    });

    // Optimistically reorder local state before persisting.
    const byId = new Map<string, CardDTO>();
    board.lists.forEach((l) => l.cards.forEach((c) => byId.set(c.id, c)));

    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lists: prev.lists.map((l) => {
          if (l.id === sourceList.id) {
            return {
              ...l,
              cards: sourceOrder.map((id, i) => ({
                ...(byId.get(id) as CardDTO),
                listId: sourceList.id,
                position: i,
              })),
            };
          }
          if (!sameList && l.id === destList.id) {
            return {
              ...l,
              cards: destOrder.map((id, i) => ({
                ...(byId.get(id) as CardDTO),
                listId: destList.id,
                position: i,
              })),
            };
          }
          return l;
        }),
      };
    });

    await fetch(`/api/cards/${draggableId}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destListId: destList.id,
        destIndex: destination.index,
      }),
    });
  }

  async function addList(title: string) {
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardId, title }),
    });
    if (res.ok) {
      const list = (await res.json()) as ListDTO;
      setBoard((prev) =>
        prev ? { ...prev, lists: [...prev.lists, { ...list, cards: [] }] } : prev
      );
    }
  }

  async function addCard(listId: string, title: string) {
    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId, title }),
    });
    if (res.ok) {
      const card = (await res.json()) as CardDTO;
      const list = board?.lists.find((l) => l.id === listId);
      updateListCards(listId, [...(list?.cards ?? []), card]);
    }
  }

  async function deleteCard(listId: string, cardId: string) {
    await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
    const list = board?.lists.find((l) => l.id === listId);
    updateListCards(listId, (list?.cards ?? []).filter((c) => c.id !== cardId));
  }

  async function deleteList(listId: string) {
    await fetch(`/api/lists/${listId}`, { method: "DELETE" });
    setBoard((prev) =>
      prev ? { ...prev, lists: prev.lists.filter((l) => l.id !== listId) } : prev
    );
  }

  if (loading) return <p className="text-slate-400">Loading board…</p>;
  if (error || !board)
    return (
      <div>
        <p className="text-slate-400">{error ?? "Something went wrong."}</p>
        <Link href="/" className="text-sky-400 hover:underline">
          ← Back to boards
        </Link>
      </div>
    );

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
          ← Boards
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{board.title}</h1>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="thin-scroll flex items-start gap-4 overflow-x-auto pb-4">
          {board.lists.map((list) => (
            <ListColumn
              key={list.id}
              list={list}
              onAddCard={addCard}
              onDeleteCard={deleteCard}
              onDeleteList={deleteList}
            />
          ))}
          <AddListForm onAdd={addList} />
        </div>
      </DragDropContext>
    </div>
  );
}

function ListColumn({
  list,
  onAddCard,
  onDeleteCard,
  onDeleteList,
}: {
  list: ListDTO;
  onAddCard: (listId: string, title: string) => void;
  onDeleteCard: (listId: string, cardId: string) => void;
  onDeleteList: (listId: string) => void;
}) {
  const [title, setTitle] = useState("");

  return (
    <div className="w-72 shrink-0 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">{list.title}</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
            {list.cards.length}
          </span>
          <button
            onClick={() => onDeleteList(list.id)}
            aria-label={`Delete list ${list.title}`}
            className="text-slate-500 hover:text-red-400"
          >
            ✕
          </button>
        </div>
      </div>

      <Droppable droppableId={list.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`min-h-[8px] space-y-2 rounded-lg p-1 transition ${
              snapshot.isDraggingOver ? "bg-slate-800/60" : ""
            }`}
          >
            {list.cards.map((card, index) => (
              <Draggable key={card.id} draggableId={card.id} index={index}>
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    className={`group rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm shadow-sm transition ${
                      dragSnapshot.isDragging
                        ? "border-sky-500 ring-2 ring-sky-500/40"
                        : "hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span>{card.title}</span>
                      <button
                        onClick={() => onDeleteCard(list.id, card.id)}
                        aria-label={`Delete card ${card.title}`}
                        className="text-slate-500 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                    {card.description ? (
                      <p className="mt-1 text-xs text-slate-400">
                        {card.description}
                      </p>
                    ) : null}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = title.trim();
          if (!trimmed) return;
          onAddCard(list.id, trimmed);
          setTitle("");
        }}
        className="mt-2"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="+ Add a card"
          aria-label={`Add a card to ${list.title}`}
          className="w-full rounded-lg border border-transparent bg-slate-800/60 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-sky-500 focus:bg-slate-800"
        />
      </form>
    </div>
  );
}

function AddListForm({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = title.trim();
        if (!trimmed) return;
        onAdd(trimmed);
        setTitle("");
      }}
      className="w-72 shrink-0 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-3"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="+ Add another list"
        aria-label="Add another list"
        className="w-full rounded-lg bg-transparent px-2 py-1 text-sm outline-none placeholder:text-slate-400"
      />
    </form>
  );
}
