"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvided,
  type DraggableStateSnapshot,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarClock,
  Filter,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import type {
  ArchivedCardDTO,
  BoardDTO,
  BoardSummary,
  CardDTO,
  ListDTO,
  MemberDTO,
} from "@/lib/types";
import { applyCardDragToLists } from "@/lib/board-dnd";
import {
  applyCardViewFilters,
  type TaskSortMode,
} from "@/lib/card-filters";
import {
  assigneeDisplayName,
  memberDisplayName,
} from "@/lib/member-display";
import { ApiError, fetchJson } from "@/lib/api-client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type CardMutationPayload = {
  title: string;
  description: string | null;
  assigneeMemberId: string | null;
  startDate: string | null;
  dueDate: string | null;
};

type CardModalState =
  | { mode: "create"; listId: string }
  | { mode: "edit"; listId: string; card: CardDTO }
  | null;

type ArchiveConfirmState = {
  cardId: string;
  title: string;
} | null;

type ListDeleteConfirmState = {
  listId: string;
  title: string;
} | null;

type ListRenameState = {
  listId: string;
  title: string;
} | null;

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
  const queryClient = useQueryClient();
  const { data: sessionData } = useSession();
  const currentMember = sessionData?.member ?? null;

  const [cardModalState, setCardModalState] = useState<CardModalState>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<ArchiveConfirmState>(null);
  const [archiving, setArchiving] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [listRename, setListRename] = useState<ListRenameState>(null);
  const [listRenaming, setListRenaming] = useState(false);
  const [listDeleteConfirm, setListDeleteConfirm] =
    useState<ListDeleteConfirmState>(null);
  const [listDeleting, setListDeleting] = useState(false);
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [sortMode, setSortMode] = useState<TaskSortMode>("position");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newListTitle, setNewListTitle] = useState("");

  const boardQuery = useQuery({
    queryKey: ["board", boardId],
    queryFn: () =>
      fetchJson<BoardDTO>(`/api/boards/${boardId}`, { cache: "no-store" }),
  });

  const archivedQuery = useQuery({
    queryKey: ["board", boardId, "archived"],
    enabled: archiveOpen,
    queryFn: () =>
      fetchJson<ArchivedCardDTO[]>(`/api/boards/${boardId}/archived`, {
        cache: "no-store",
      }),
  });

  const board = boardQuery.data ?? null;
  const dragDisabled = myTasksOnly || sortMode !== "position";

  /**
   * Lists shown in the board. When drag is enabled we keep the stored card
   * array order (already position-sorted from the API) so DnD indices stay
   * aligned with optimistic updates.
   */
  const visibleLists = useMemo(() => {
    if (!board) {
      return [];
    }

    if (!dragDisabled) {
      return board.lists;
    }

    return board.lists.map((list) => ({
      ...list,
      cards: applyCardViewFilters({
        cards: list.cards,
        memberId: currentMember?.id ?? null,
        myTasksOnly,
        sortMode,
      }),
    }));
  }, [board, currentMember?.id, dragDisabled, myTasksOnly, sortMode]);

  function setBoardCache(updater: (prev: BoardDTO) => BoardDTO) {
    queryClient.setQueryData<BoardDTO>(["board", boardId], (prev) =>
      prev ? updater(prev) : prev
    );
  }

  const addListMutation = useMutation({
    mutationFn: (title: string) =>
      fetchJson<ListDTO>("/api/lists", {
        method: "POST",
        body: JSON.stringify({ boardId, title }),
      }),
    onSuccess: (list) => {
      setBoardCache((prev) => ({
        ...prev,
        lists: [...prev.lists, { ...list, cards: [] }],
      }));
      setNewListTitle("");
    },
  });

  async function renameList() {
    if (!listRename) {
      return;
    }

    const trimmed = listRename.title.trim();
    if (!trimmed) {
      setError("Tên danh sách không được để trống.");
      return;
    }

    setListRenaming(true);
    try {
      const updated = await fetchJson<ListDTO>(
        `/api/lists/${listRename.listId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ title: trimmed }),
        }
      );
      setBoardCache((prev) => ({
        ...prev,
        lists: prev.lists.map((list) =>
          list.id === updated.id ? { ...list, title: updated.title } : list
        ),
      }));
      setListRename(null);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không thể đổi tên danh sách."
      );
    } finally {
      setListRenaming(false);
    }
  }

  async function confirmDeleteList() {
    if (!listDeleteConfirm) {
      return;
    }

    const target = board?.lists.find(
      (list) => list.id === listDeleteConfirm.listId
    );
    if (!target || target.cards.length > 0) {
      setError("Chỉ có thể xóa danh sách khi không còn thẻ nào bên trong.");
      return;
    }

    setListDeleting(true);
    try {
      await fetchJson<{ ok: boolean }>(
        `/api/lists/${listDeleteConfirm.listId}`,
        { method: "DELETE" }
      );
      setBoardCache((prev) => ({
        ...prev,
        lists: prev.lists.filter(
          (list) => list.id !== listDeleteConfirm.listId
        ),
      }));
      setListDeleteConfirm(null);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không thể xóa danh sách."
      );
    } finally {
      setListDeleting(false);
    }
  }

  async function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination || !board || dragDisabled) {
      return;
    }
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    // Use currently rendered lists so destIndex matches what the user saw.
    const nextLists = applyCardDragToLists({
      lists: visibleLists,
      sourceListId: source.droppableId,
      destListId: destination.droppableId,
      cardId: draggableId,
      destIndex: destination.index,
    });

    if (!nextLists) {
      return;
    }

    setBoardCache((prev) => ({
      ...prev,
      lists: nextLists,
    }));

    try {
      await fetchJson(`/api/cards/${draggableId}/move`, {
        method: "PATCH",
        body: JSON.stringify({
          destListId: destination.droppableId,
          destIndex: destination.index,
        }),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể di chuyển thẻ.");
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    }
  }

  async function addCard(
    listId: string,
    payload: CardMutationPayload
  ): Promise<boolean> {
    try {
      const card = await fetchJson<CardDTO>("/api/cards", {
        method: "POST",
        body: JSON.stringify({ listId, ...payload }),
      });
      setBoardCache((prev) => ({
        ...prev,
        lists: prev.lists.map((list) =>
          list.id === listId
            ? { ...list, cards: [...list.cards, card] }
            : list
        ),
      }));
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể thêm thẻ.");
      return false;
    }
  }

  async function updateCard(
    listId: string,
    cardId: string,
    payload: CardMutationPayload
  ): Promise<boolean> {
    try {
      const card = await fetchJson<CardDTO>(`/api/cards/${cardId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setBoardCache((prev) => ({
        ...prev,
        lists: prev.lists.map((list) =>
          list.id !== listId
            ? list
            : {
                ...list,
                cards: list.cards.map((item) =>
                  item.id === card.id ? card : item
                ),
              }
        ),
      }));
      return true;
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không thể cập nhật thẻ."
      );
      return false;
    }
  }

  async function archiveCard(cardId: string, archived: boolean) {
    try {
      await fetchJson<CardDTO>(`/api/cards/${cardId}/archive`, {
        method: "PATCH",
        body: JSON.stringify({ archived }),
      });
      if (archived) {
        setBoardCache((prev) => ({
          ...prev,
          lists: prev.lists.map((list) => ({
            ...list,
            cards: list.cards.filter((card) => card.id !== cardId),
          })),
        }));
      } else {
        await queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      }
      await queryClient.invalidateQueries({
        queryKey: ["board", boardId, "archived"],
      });
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không thể cập nhật lưu trữ."
      );
      throw err;
    }
  }

  async function confirmArchive() {
    if (!archiveConfirm) {
      return;
    }

    setArchiving(true);
    try {
      await archiveCard(archiveConfirm.cardId, true);
      setArchiveConfirm(null);
      setCardModalState(null);
    } catch {
      // Error message already set in archiveCard.
    } finally {
      setArchiving(false);
    }
  }

  async function renameBoard() {
    const trimmed = renameTitle.trim();
    if (!trimmed) {
      setError("Tên bảng không được để trống.");
      return;
    }

    setRenaming(true);
    try {
      const updated = await fetchJson<BoardSummary>(`/api/boards/${boardId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: trimmed }),
      });
      setBoardCache((prev) => ({ ...prev, title: updated.title }));
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      setRenameOpen(false);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Không thể đổi tên bảng."
      );
    } finally {
      setRenaming(false);
    }
  }

  async function deleteCard(listId: string, cardId: string) {
    try {
      await fetchJson(`/api/cards/${cardId}`, { method: "DELETE" });
      setBoardCache((prev) => ({
        ...prev,
        lists: prev.lists.map((list) =>
          list.id === listId
            ? {
                ...list,
                cards: list.cards.filter((card) => card.id !== cardId),
              }
            : list
        ),
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể xóa thẻ.");
    }
  }

  if (boardQuery.isLoading) {
    return <p className="text-muted-foreground">Đang tải bảng công việc…</p>;
  }

  if (!board) {
    return (
      <div>
        <p className="text-muted-foreground">
          {boardQuery.error instanceof Error
            ? boardQuery.error.message
            : "Không tìm thấy bảng công việc."}
        </p>
        <Button asChild variant="link" className="px-0">
          <Link href="/">← Quay lại danh sách bảng</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Bảng
          </Link>
        </Button>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {board.title}
        </h1>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Đổi tên bảng"
          onClick={() => {
            setRenameTitle(board.title);
            setRenameOpen(true);
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        {board.archivedAt ? (
          <Badge variant="accent">Đã lưu trữ</Badge>
        ) : (
          <Badge variant="secondary">Dùng chung workspace</Badge>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="my-tasks" className="text-xs text-muted-foreground">
              Việc của tôi
            </Label>
            <Switch
              id="my-tasks"
              checked={myTasksOnly}
              onCheckedChange={setMyTasksOnly}
            />
          </div>

          <Select
            value={sortMode}
            onValueChange={(value) => setSortMode(value as TaskSortMode)}
          >
            <SelectTrigger className="w-[180px]">
              <CalendarClock className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Sắp xếp" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="position">Thứ tự bảng</SelectItem>
              <SelectItem value="dueDateAsc">Hạn tăng dần</SelectItem>
              <SelectItem value="dueDateDesc">Hạn giảm dần</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant={archiveOpen ? "default" : "outline"}
            size="sm"
            aria-label="Xem thẻ đã lưu trữ"
            onClick={() => setArchiveOpen((open) => !open)}
          >
            <Archive className="h-4 w-4" />
            Thẻ lưu trữ
          </Button>
        </div>
      </div>

      {board.archivedAt ? (
        <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Bảng này đang được lưu trữ. Khôi phục từ trang danh sách bảng.
        </p>
      ) : null}

      {dragDisabled ? (
        <p className="mb-3 text-xs text-muted-foreground">
          Kéo thả tạm tắt khi đang lọc “Việc của tôi” hoặc sắp xếp theo ngày.
        </p>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </p>
      ) : null}

      <div className="flex gap-4">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="smooth-scroll flex min-w-0 flex-1 items-start gap-4 overflow-x-auto pb-4">
            {visibleLists.map((list) => (
              <ListColumn
                key={list.id}
                list={list}
                dragDisabled={dragDisabled}
                onOpenCreateCardModal={() =>
                  setCardModalState({ mode: "create", listId: list.id })
                }
                onOpenEditCardModal={(card) =>
                  setCardModalState({ mode: "edit", listId: list.id, card })
                }
                onRequestArchiveCard={(card) =>
                  setArchiveConfirm({ cardId: card.id, title: card.title })
                }
                onRequestRenameList={() =>
                  setListRename({ listId: list.id, title: list.title })
                }
                onRequestDeleteList={() =>
                  setListDeleteConfirm({ listId: list.id, title: list.title })
                }
              />
            ))}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = newListTitle.trim();
                if (!trimmed || addListMutation.isPending) return;
                addListMutation.mutate(trimmed);
              }}
              className="w-72 shrink-0 rounded-xl border border-dashed border-border bg-card/70 p-3"
            >
              <Input
                value={newListTitle}
                onChange={(event) => setNewListTitle(event.target.value)}
                placeholder="+ Thêm danh sách"
                aria-label="Thêm danh sách mới"
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
            </form>
          </div>
        </DragDropContext>

        {archiveOpen ? (
          <aside className="w-80 shrink-0 animate-fade-in rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display font-semibold">Lưu trữ</h2>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setArchiveOpen(false)}
              >
                Đóng
              </Button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Thẻ lưu trữ được tải riêng để bảng chính nhanh hơn.
            </p>
            {archivedQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Đang tải…</p>
            ) : !archivedQuery.data?.length ? (
              <p className="text-sm text-muted-foreground">Chưa có thẻ lưu trữ.</p>
            ) : (
              <ul className="space-y-2">
                {archivedQuery.data.map((card) => (
                  <li
                    key={card.id}
                    className="rounded-lg border bg-secondary/40 p-3 text-sm"
                  >
                    <p className="font-medium">{card.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {card.listTitle}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => archiveCard(card.id, false)}
                    >
                      <ArchiveRestore className="h-3.5 w-3.5" />
                      Khôi phục
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        ) : null}
      </div>

      {cardModalState ? (
        <CardDetailModal
          mode={cardModalState.mode}
          listId={cardModalState.listId}
          workspaceMembers={board.members}
          card={cardModalState.mode === "edit" ? cardModalState.card : null}
          onClose={() => setCardModalState(null)}
          onCreate={addCard}
          onUpdate={updateCard}
          onRequestArchive={(card) =>
            setArchiveConfirm({ cardId: card.id, title: card.title })
          }
          onDelete={deleteCard}
          onError={setError}
        />
      ) : null}

      <AlertDialog
        open={Boolean(archiveConfirm)}
        onOpenChange={(open) => {
          if (!open && !archiving) {
            setArchiveConfirm(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lưu trữ thẻ này?</AlertDialogTitle>
            <AlertDialogDescription>
              Thẻ “{archiveConfirm?.title}” sẽ được đưa vào mục lưu trữ và ẩn
              khỏi bảng. Bạn có thể khôi phục bất cứ lúc nào từ biểu tượng lưu
              trữ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              disabled={archiving}
              onClick={(event) => {
                event.preventDefault();
                void confirmArchive();
              }}
            >
              {archiving ? "Đang lưu trữ…" : "Xác nhận lưu trữ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi tên bảng</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="board-title">Tên bảng</Label>
            <Input
              id="board-title"
              value={renameTitle}
              onChange={(event) => setRenameTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void renameBoard();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => void renameBoard()}
              disabled={renaming || !renameTitle.trim()}
            >
              {renaming ? "Đang lưu…" : "Lưu tên mới"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(listRename)}
        onOpenChange={(open) => {
          if (!open && !listRenaming) {
            setListRename(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi tên danh sách</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="list-title">Tên danh sách</Label>
            <Input
              id="list-title"
              value={listRename?.title ?? ""}
              onChange={(event) =>
                setListRename((prev) =>
                  prev ? { ...prev, title: event.target.value } : prev
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void renameList();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => void renameList()}
              disabled={listRenaming || !listRename?.title.trim()}
            >
              {listRenaming ? "Đang lưu…" : "Lưu tên mới"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(listDeleteConfirm)}
        onOpenChange={(open) => {
          if (!open && !listDeleting) {
            setListDeleteConfirm(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa danh sách này?</AlertDialogTitle>
            <AlertDialogDescription>
              Danh sách “{listDeleteConfirm?.title}” sẽ bị xóa vĩnh viễn. Chỉ
              xóa được khi danh sách đang trống.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={listDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                listDeleting ||
                !listDeleteConfirm ||
                (board.lists.find(
                  (list) => list.id === listDeleteConfirm.listId
                )?.cards.length ?? 0) > 0
              }
              onClick={(event) => {
                event.preventDefault();
                void confirmDeleteList();
              }}
            >
              {listDeleting ? "Đang xóa…" : "Xác nhận xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ListColumn({
  list,
  dragDisabled,
  onOpenCreateCardModal,
  onOpenEditCardModal,
  onRequestArchiveCard,
  onRequestRenameList,
  onRequestDeleteList,
}: {
  list: ListDTO;
  dragDisabled: boolean;
  onOpenCreateCardModal: () => void;
  onOpenEditCardModal: (card: CardDTO) => void;
  onRequestArchiveCard: (card: CardDTO) => void;
  onRequestRenameList: () => void;
  onRequestDeleteList: () => void;
}) {
  const isEmpty = list.cards.length === 0;

  return (
    <div className="w-72 shrink-0 rounded-xl border bg-board-column p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="min-w-0 flex-1 truncate font-display font-semibold">
          {list.title}
        </h2>
        <div className="flex shrink-0 items-center gap-0.5">
          <Badge variant="secondary">{list.cards.length}</Badge>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Đổi tên danh sách ${list.title}`}
            onClick={onRequestRenameList}
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Xóa danh sách ${list.title}`}
            disabled={!isEmpty}
            title={
              isEmpty
                ? "Xóa danh sách"
                : "Chỉ xóa được khi danh sách trống"
            }
            onClick={onRequestDeleteList}
          >
            <Trash2
              className={cn(
                "h-3.5 w-3.5",
                isEmpty ? "text-muted-foreground" : "text-muted-foreground/40"
              )}
            />
          </Button>
        </div>
      </div>

      <Droppable droppableId={list.id} type="CARD" isDropDisabled={dragDisabled}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "min-h-[48px] space-y-2 rounded-lg p-1",
              snapshot.isDraggingOver && "bg-accent/60"
            )}
          >
            {list.cards.map((card, index) => (
              <Draggable
                key={card.id}
                draggableId={card.id}
                index={index}
                isDragDisabled={dragDisabled}
              >
                {(dragProvided, dragSnapshot) => (
                  <CardPreview
                    card={card}
                    dragProvided={dragProvided}
                    dragSnapshot={dragSnapshot}
                    onOpenCard={onOpenEditCardModal}
                    onRequestArchiveCard={onRequestArchiveCard}
                  />
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <Button
        type="button"
        variant="outline"
        className="mt-2 w-full border-dashed"
        onClick={onOpenCreateCardModal}
      >
        <Plus className="h-4 w-4" />
        Thêm thẻ
      </Button>
    </div>
  );
}

function CardPreview({
  card,
  dragProvided,
  dragSnapshot,
  onOpenCard,
  onRequestArchiveCard,
}: {
  card: CardDTO;
  dragProvided: DraggableProvided;
  dragSnapshot: DraggableStateSnapshot;
  onOpenCard: (card: CardDTO) => void;
  onRequestArchiveCard: (card: CardDTO) => void;
}) {
  return (
    <div
      ref={dragProvided.innerRef}
      {...dragProvided.draggableProps}
      {...dragProvided.dragHandleProps}
      onClick={() => {
        if (!dragSnapshot.isDragging) {
          onOpenCard(card);
        }
      }}
      className={cn(
        // Avoid Tailwind `transition` (includes transform) — it breaks dnd positioning.
        "group cursor-grab rounded-lg border bg-card p-3 text-sm shadow-sm transition-colors hover:border-primary/30 active:cursor-grabbing",
        dragSnapshot.isDragging &&
          "border-primary bg-card shadow-md ring-2 ring-primary/20 transition-none"
      )}
      style={dragProvided.draggableProps.style}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{card.title}</span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
          aria-label={`Lưu trữ thẻ ${card.title}`}
          onClick={(event) => {
            event.stopPropagation();
            onRequestArchiveCard(card);
          }}
        >
          <Archive className="h-3.5 w-3.5" />
        </Button>
      </div>
      {card.description ? (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {card.description}
        </p>
      ) : null}
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        <p className="flex items-center gap-1">
          <UserRound className="h-3 w-3" />
          {assigneeDisplayName(
            card.assigneeMemberName,
            card.assigneeMemberEmail
          )}
        </p>
        <p>Hạn: {formatDate(card.dueDate)}</p>
      </div>
    </div>
  );
}

function CardDetailModal({
  mode,
  listId,
  workspaceMembers,
  card,
  onClose,
  onCreate,
  onUpdate,
  onRequestArchive,
  onDelete,
  onError,
}: {
  mode: "create" | "edit";
  listId: string;
  workspaceMembers: MemberDTO[];
  card: CardDTO | null;
  onClose: () => void;
  onCreate: (listId: string, payload: CardMutationPayload) => Promise<boolean>;
  onUpdate: (
    listId: string,
    cardId: string,
    payload: CardMutationPayload
  ) => Promise<boolean>;
  onRequestArchive: (card: CardDTO) => void;
  onDelete: (listId: string, cardId: string) => Promise<void> | void;
  onError: (message: string | null) => void;
}) {
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [assigneeMemberId, setAssigneeMemberId] = useState(
    card?.assigneeMemberId ?? "unassigned"
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
      assigneeMemberId:
        assigneeMemberId === "unassigned" ? null : assigneeMemberId,
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

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Tạo thẻ công việc" : "Chi tiết thẻ công việc"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="card-title">Tiêu đề</Label>
            <Input
              id="card-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="card-description">Mô tả</Label>
            <Textarea
              id="card-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Người phụ trách</Label>
            <Select
              value={assigneeMemberId}
              onValueChange={setAssigneeMemberId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chưa giao" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Chưa giao</SelectItem>
                {workspaceMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {memberDisplayName(member)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start-date">Ngày bắt đầu</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due-date">Hạn hoàn thành</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {mode === "edit" && card ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onRequestArchive(card)}
              >
                <Archive className="h-4 w-4" />
                Lưu trữ
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  await onDelete(listId, card.id);
                  onClose();
                }}
              >
                Xóa
              </Button>
            </>
          ) : null}
          <Button type="button" onClick={submit} disabled={saving}>
            {saving ? "Đang lưu…" : mode === "create" ? "Tạo thẻ" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
