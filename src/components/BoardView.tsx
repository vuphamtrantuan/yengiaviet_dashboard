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
import type { BoardDTO, CardDTO, ListDTO, MemberDTO } from "@/lib/types";
import { computeMove } from "@/lib/board";

type CardMutationPayload = {
  title: string;
  description: string | null;
  assigneeMemberId: string | null;
  startDate: string | null;
  dueDate: string | null;
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

type CardModalState =
  | { mode: "create"; listId: string }
  | { mode: "edit"; listId: string; card: CardDTO }
  | null;

export default function BoardView({ boardId }: { boardId: string }) {
  const [board, setBoard] = useState<BoardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cardModalState, setCardModalState] = useState<CardModalState>(null);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  const loadBoard = useCallback(async () => {
    const res = await fetch(`/api/boards/${boardId}`, { cache: "no-store" });
    if (!res.ok) {
      const response = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (res.status === 401) {
        setError("Vui lòng đăng nhập để truy cập bảng công việc.");
      } else if (res.status === 403) {
        setError(response?.error ?? "Bạn không có quyền truy cập bảng này.");
      } else {
        setError(response?.error ?? "Không tìm thấy bảng công việc.");
      }
      setLoading(false);
      return;
    }
    setBoard((await res.json()) as BoardDTO);
    setError(null);
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

  function appendMember(member: MemberDTO) {
    setBoard((prev) => {
      if (!prev) {
        return prev;
      }

      if (prev.members.some((item) => item.id === member.id)) {
        return prev;
      }

      return {
        ...prev,
        members: [...prev.members, member].sort((a, b) =>
          a.email.localeCompare(b.email)
        ),
      };
    });
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

  async function addCard(listId: string, payload: CardMutationPayload): Promise<boolean> {
    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId, ...payload }),
    });
    if (res.ok) {
      const card = (await res.json()) as CardDTO;
      const list = board?.lists.find((l) => l.id === listId);
      updateListCards(listId, [...(list?.cards ?? []), card]);
      return true;
    }

    const response = (await res.json().catch(() => null)) as { error?: string } | null;
    setError(response?.error ?? "Không thể thêm thẻ công việc.");
    return false;
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

  async function addMemberByEmail(): Promise<boolean> {
    const trimmedEmail = memberEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Vui lòng nhập email thành viên.");
      return false;
    }

    setAddingMember(true);
    const res = await fetch(`/api/boards/${boardId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmedEmail }),
    });
    setAddingMember(false);

    if (!res.ok) {
      const response = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(response?.error ?? "Không thể thêm thành viên.");
      return false;
    }

    const response = (await res.json()) as { member: MemberDTO };
    appendMember(response.member);
    setMemberEmail("");
    setMemberModalOpen(false);
    setError(null);
    return true;
  }

  if (loading) return <p className="text-slate-400">Đang tải bảng công việc…</p>;
  if (!board)
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
        <button
          type="button"
          onClick={() => setMemberModalOpen(true)}
          className="ml-auto rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-500"
        >
          + Thêm thành viên
        </button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {board.members.map((member) => (
          <span
            key={member.id}
            className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-200"
          >
            {member.email}
          </span>
        ))}
      </div>
      {error ? (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="thin-scroll flex items-start gap-4 overflow-x-auto pb-4">
          {board.lists.map((list) => (
            <ListColumn
              key={list.id}
              list={list}
              onOpenCreateCardModal={() =>
                setCardModalState({ mode: "create", listId: list.id })
              }
              onOpenEditCardModal={(card) =>
                setCardModalState({ mode: "edit", listId: list.id, card })
              }
              onDeleteCard={deleteCard}
              onDeleteList={deleteList}
            />
          ))}
          <AddListForm onAdd={addList} />
        </div>
      </DragDropContext>

      {cardModalState ? (
        <CardDetailModal
          mode={cardModalState.mode}
          listId={cardModalState.listId}
          boardMembers={board.members}
          card={cardModalState.mode === "edit" ? cardModalState.card : null}
          onClose={() => setCardModalState(null)}
          onCreate={addCard}
          onUpdate={updateCard}
          onDelete={deleteCard}
          onError={setError}
        />
      ) : null}

      {memberModalOpen ? (
        <ModalShell title="Thêm thành viên" onClose={() => setMemberModalOpen(false)}>
          <p className="text-sm text-slate-400">
            Nhập email để thêm thành viên vào bảng.
          </p>
          <input
            type="email"
            value={memberEmail}
            onChange={(event) => setMemberEmail(event.target.value)}
            placeholder="member@company.com"
            className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          <button
            type="button"
            onClick={addMemberByEmail}
            disabled={addingMember}
            className="mt-3 w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {addingMember ? "Đang thêm…" : "Thêm thành viên"}
          </button>
        </ModalShell>
      ) : null}
    </div>
  );
}

function ListColumn({
  list,
  onOpenCreateCardModal,
  onOpenEditCardModal,
  onDeleteCard,
  onDeleteList,
}: {
  list: ListDTO;
  onOpenCreateCardModal: () => void;
  onOpenEditCardModal: (card: CardDTO) => void;
  onDeleteCard: (listId: string, cardId: string) => void;
  onDeleteList: (listId: string) => void;
}) {
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
                  <CardPreview
                    listId={list.id}
                    card={card}
                    dragProvided={dragProvided}
                    dragSnapshot={dragSnapshot}
                    onOpenCard={onOpenEditCardModal}
                    onDeleteCard={onDeleteCard}
                  />
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <button
        type="button"
        onClick={onOpenCreateCardModal}
        className="mt-2 w-full rounded-lg border border-dashed border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
      >
        + Thêm thẻ
      </button>
    </div>
  );
}

function CardPreview({
  listId,
  card,
  dragProvided,
  dragSnapshot,
  onOpenCard,
  onDeleteCard,
}: {
  listId: string;
  card: CardDTO;
  dragProvided: DraggableProvided;
  dragSnapshot: DraggableStateSnapshot;
  onOpenCard: (card: CardDTO) => void;
  onDeleteCard: (listId: string, cardId: string) => void;
}) {
  return (
    <div
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
      {...dragProvided.dragHandleProps}
      onClick={() => onOpenCard(card)}
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
            onClick={(event) => {
              event.stopPropagation();
              onDeleteCard(listId, card.id);
            }}
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
          <span className="text-slate-400">Người phụ trách:</span> {card.assigneeMemberEmail ?? "Chưa gán"}
        </p>
        <p>
          <span className="text-slate-400">Bắt đầu:</span>{" "}
          {formatDate(card.startDate)}
        </p>
        <p>
          <span className="text-slate-400">Hạn:</span> {formatDate(card.dueDate)}
        </p>
      </div>
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

function CardDetailModal({
  mode,
  listId,
  boardMembers,
  card,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onError,
}: {
  mode: "create" | "edit";
  listId: string;
  boardMembers: MemberDTO[];
  card: CardDTO | null;
  onClose: () => void;
  onCreate: (listId: string, payload: CardMutationPayload) => Promise<boolean>;
  onUpdate: (
    listId: string,
    cardId: string,
    payload: CardMutationPayload
  ) => Promise<boolean>;
  onDelete: (listId: string, cardId: string) => Promise<void> | void;
  onError: (message: string | null) => void;
}) {
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [assigneeMemberId, setAssigneeMemberId] = useState(
    card?.assigneeMemberId ?? ""
  );
  const [startDate, setStartDate] = useState(card?.startDate ?? "");
  const [dueDate, setDueDate] = useState(card?.dueDate ?? "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      onError("Tiêu đề công việc là bắt buộc.");
      return;
    }

    if (startDate && dueDate && dueDate < startDate) {
      onError("Hạn hoàn thành không được sớm hơn ngày bắt đầu.");
      return;
    }

    setSaving(true);
    const payload: CardMutationPayload = {
      title: trimmedTitle,
      description: description.trim() || null,
      assigneeMemberId: assigneeMemberId || null,
      startDate: startDate || null,
      dueDate: dueDate || null,
    };

    const ok =
      mode === "create"
        ? await onCreate(listId, payload)
        : await onUpdate(listId, card!.id, payload);
    setSaving(false);

    if (ok) {
      onError(null);
      onClose();
    }
  }

  async function removeCard() {
    if (!card) return;
    await onDelete(listId, card.id);
    onClose();
  }

  return (
    <ModalShell
      title={mode === "create" ? "Tạo thẻ công việc" : "Chi tiết thẻ công việc"}
      onClose={onClose}
    >
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400">Tiêu đề</label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">Mô tả</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">Người phụ trách</label>
          <select
            value={assigneeMemberId}
            onChange={(event) => setAssigneeMemberId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-500"
          >
            <option value="">Chưa giao</option>
            {boardMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.email}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-400">
            Ngày bắt đầu
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
          </label>
          <label className="text-xs text-slate-400">
            Hạn hoàn thành
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" ? (
            <button
              type="button"
              onClick={removeCard}
              className="rounded-lg border border-red-500/50 px-3 py-2 text-sm text-red-300 transition hover:border-red-400 hover:text-red-200"
            >
              Xóa thẻ
            </button>
          ) : null}
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="ml-auto rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Đang lưu…" : mode === "create" ? "Tạo thẻ" : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 transition hover:border-slate-500 hover:text-white"
          >
            Đóng
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
