export interface CardDTO {
  id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  startDate: string | null;
  dueDate: string | null;
  position: number;
  listId: string;
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
}

export interface BoardSummary {
  id: string;
  title: string;
  createdAt: string;
  _count: { lists: number };
}
