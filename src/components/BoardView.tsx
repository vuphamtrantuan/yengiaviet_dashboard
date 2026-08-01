"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvided,
  type DraggableStateSnapshot,
  type DropResult,
} from "@hello-pangea/dnd";
import type { BoardDTO, CardDTO, ListDTO } from "@/lib/types";
import { computeMove } from "@/lib/board";

type CardMutationPayload = {
  title?: string;
  description?: string | null;
  assignee?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
};

function formatDate(value: string | null): string {
  if (!value) {
    return "Chưa đặt";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN").format(parsed);
}

export default function BoardView({ boardId }: { boardId: string }) {
  const [board, setBoard] = useState<BoardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    const res = await fetch(`/api/boards/${boardId}`, { cache: "no-store" });
    if (!res.ok) {
      setError("Không tìm thấy bảng công việc.");
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

  function upsertCardInList(listId: string, updatedCard: CardDTO) {
    setBoard((prev) =>
      prev
        ? {
            ...prev,
            lists: prev.lists.map((list) =>
              list.id !== listId
                ? list
                : {
                    ...list,
                    cards: list.cards.map((card) =>
                      card.id === updatedCard.id ? updatedCard : card
                    ),
                  }
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

  async function addCard(
    listId: string,
    payload: {
      title: string;
      description: string;
      assignee: string;
      startDate: string;
      dueDate: string;
    }
  ) {
    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId, ...payload }),
    });
    if (res.ok) {
      const card = (await res.json()) as CardDTO;
      const list = board?.lists.find((l) => l.id === listId);
      updateListCards(listId, [...(list?.cards ?? []), card]);
      return;
    }

    const response = (await res.json().catch(() => null)) as { error?: string } | null;
    setError(response?.error ?? "Không thể thêm thẻ công việc.");
  }

  async function updateCard(
    listId: string,
    cardId: string,
    payload: CardMutationPayload
  ): Promise<boolean> {
    const res = await fetch(`/api/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const response = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(response?.error ?? "Không thể cập nhật thẻ công việc.");
      return false;
    }

    const card = (await res.json()) as CardDTO;
    upsertCardInList(listId, card);
    return true;
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

  if (loading) return <p className="text-slate-400">Đang tải bảng công việc…</p>;
  if (error || !board)
    return (
      <div>
        <p className="text-slate-400">{error ?? "Đã xảy ra lỗi không mong muốn."}</p>
        <Link href="/" className="text-sky-400 hover:underline">
          ← Quay lại danh sách bảng
        </Link>
      </div>
    );

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
          ← Bảng công việc
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
              onUpdateCard={updateCard}
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
  onUpdateCard,
  onDeleteCard,
  onDeleteList,
}: {
  list: ListDTO;
  onAddCard: (
    listId: string,
    payload: {
      title: string;
      description: string;
      assignee: string;
      startDate: string;
      dueDate: string;
    }
  ) => void;
  onUpdateCard: (
    listId: string,
    cardId: string,
    payload: CardMutationPayload
  ) => Promise<boolean>;
  onDeleteCard: (listId: string, cardId: string) => void;
  onDeleteList: (listId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

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
            aria-label={`Xóa danh sách ${list.title}`}
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
                  <CardItem
                    listId={list.id}
                    card={card}
                    dragProvided={dragProvided}
                    dragSnapshot={dragSnapshot}
                    onUpdateCard={onUpdateCard}
                    onDeleteCard={onDeleteCard}
                  />
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
          onAddCard(list.id, {
            title: trimmed,
            description: description.trim(),
            assignee: assignee.trim(),
            startDate: startDate.trim(),
            dueDate: dueDate.trim(),
          });
          setTitle("");
          setDescription("");
          setAssignee("");
          setStartDate("");
          setDueDate("");
        }}
        className="mt-2"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="+ Thêm thẻ công việc"
          aria-label={`Thêm thẻ vào danh sách ${list.title}`}
          className="w-full rounded-lg border border-transparent bg-slate-800/60 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-sky-500 focus:bg-slate-800"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mô tả (tuỳ chọn)"
          aria-label={`Mô tả thẻ trong danh sách ${list.title}`}
          rows={2}
          className="mt-2 w-full rounded-lg border border-transparent bg-slate-800/60 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-sky-500 focus:bg-slate-800"
        />
        <input
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          placeholder="Người phụ trách (tuỳ chọn)"
          aria-label={`Người phụ trách thẻ trong danh sách ${list.title}`}
          className="mt-2 w-full rounded-lg border border-transparent bg-slate-800/60 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-sky-500 focus:bg-slate-800"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-400">
            Ngày bắt đầu
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label={`Ngày bắt đầu trong danh sách ${list.title}`}
              className="mt-1 w-full rounded-lg border border-transparent bg-slate-800/60 px-2 py-2 text-sm outline-none focus:border-sky-500 focus:bg-slate-800"
            />
          </label>
          <label className="text-xs text-slate-400">
            Hạn hoàn thành
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label={`Hạn hoàn thành trong danh sách ${list.title}`}
              className="mt-1 w-full rounded-lg border border-transparent bg-slate-800/60 px-2 py-2 text-sm outline-none focus:border-sky-500 focus:bg-slate-800"
            />
          </label>
        </div>
        <button
          type="submit"
          className="mt-2 w-full rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
        >
          Tạo thẻ
        </button>
      </form>
    </div>
  );
}

function CardItem({
  listId,
  card,
  dragProvided,
  dragSnapshot,
  onUpdateCard,
  onDeleteCard,
}: {
  listId: string;
  card: CardDTO;
  dragProvided: DraggableProvided;
  dragSnapshot: DraggableStateSnapshot;
  onUpdateCard: (
    listId: string,
    cardId: string,
    payload: CardMutationPayload
  ) => Promise<boolean>;
  onDeleteCard: (listId: string, cardId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [assignee, setAssignee] = useState(card.assignee ?? "");
  const [startDate, setStartDate] = useState(card.startDate ?? "");
  const [dueDate, setDueDate] = useState(card.dueDate ?? "");
  const [saving, setSaving] = useState(false);

  async function saveCard() {
    if (!title.trim()) {
      return;
    }

    setSaving(true);
    const updated = await onUpdateCard(listId, card.id, {
      title: title.trim(),
      description: description.trim() || null,
      assignee: assignee.trim() || null,
      startDate: startDate.trim() || null,
      dueDate: dueDate.trim() || null,
    });
    setSaving(false);

    if (updated) {
      setIsEditing(false);
    }
  }

  return (
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
        <span className="font-medium">{card.title}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            className="text-xs text-slate-400 hover:text-slate-100"
          >
            {isEditing ? "Đóng" : "Sửa"}
          </button>
          <button
            onClick={() => onDeleteCard(listId, card.id)}
            aria-label={`Xóa thẻ ${card.title}`}
            className="text-slate-500 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
          >
            ✕
          </button>
        </div>
      </div>
      {card.description ? (
        <p className="mt-1 text-xs text-slate-400">{card.description}</p>
      ) : null}
      <div className="mt-2 space-y-1 text-xs text-slate-300">
        <p>
          <span className="text-slate-400">Người phụ trách:</span>{" "}
          {card.assignee ?? "Chưa gán"}
        </p>
        <p>
          <span className="text-slate-400">Bắt đầu:</span>{" "}
          {formatDate(card.startDate)}
        </p>
        <p>
          <span className="text-slate-400">Hạn:</span> {formatDate(card.dueDate)}
        </p>
      </div>

      {isEditing ? (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-700 bg-slate-900/70 p-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Tiêu đề thẻ"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm outline-none focus:border-sky-500"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Mô tả"
            aria-label="Mô tả thẻ"
            rows={2}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm outline-none focus:border-sky-500"
          />
          <input
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            placeholder="Người phụ trách"
            aria-label="Người phụ trách"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm outline-none focus:border-sky-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">
              Ngày bắt đầu
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm outline-none focus:border-sky-500"
              />
            </label>
            <label className="text-xs text-slate-400">
              Hạn hoàn thành
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm outline-none focus:border-sky-500"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={saveCard}
            disabled={saving}
            className="w-full rounded-lg bg-sky-500 px-2 py-1 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Đang lưu…" : "Lưu cập nhật"}
          </button>
        </div>
      ) : null}
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
        placeholder="+ Thêm danh sách"
        aria-label="Thêm danh sách mới"
        className="w-full rounded-lg bg-transparent px-2 py-1 text-sm outline-none placeholder:text-slate-400"
      />
    </form>
  );
}
