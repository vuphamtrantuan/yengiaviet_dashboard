export interface CardDTO {
  id: string;
  title: string;
  description: string | null;
  assigneeMemberId: string | null;
  assigneeMemberEmail: string | null;
  assigneeMemberName: string | null;
  startDate: string | null;
  dueDate: string | null;
  position: number;
  listId: string;
  archivedAt: string | null;
}

export interface MemberDTO {
  id: string;
  email: string;
  name: string | null;
}

export interface ListDTO {
  id: string;
  title: string;
  position: number;
  boardId: string;
  cards: CardDTO[];
}

export interface BoardDTO {
  id: string;
  title: string;
  createdAt: string;
  lists: ListDTO[];
  members: MemberDTO[];
}

export interface BoardSummary {
  id: string;
  title: string;
  createdAt: string;
  _count: { lists: number };
}

/** Archived card payload including parent list metadata for archive panel UX. */
export interface ArchivedCardDTO extends CardDTO {
  listTitle: string;
}
