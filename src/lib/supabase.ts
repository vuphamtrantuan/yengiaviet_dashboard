import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  BoardDTO,
  BoardSummary,
  CardDTO,
  ListDTO,
  MemberDTO,
} from "@/lib/types";

export interface BoardRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ListRow {
  id: string;
  title: string;
  position: number;
  board_id: string;
  created_at: string;
  updated_at: string;
}

export interface CardRow {
  id: string;
  title: string;
  description: string | null;
  assignee_member_id: string | null;
  start_date: string | null;
  due_date: string | null;
  position: number;
  list_id: string;
  created_at: string;
  updated_at: string;
}

export interface MemberRow {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface BoardMemberRow {
  board_id: string;
  member_id: string;
  created_at: string;
}

function isPlaceholderValue(value: string, placeholders: string[]): boolean {
  const normalized = value.toLowerCase();
  return placeholders.some((placeholder) => normalized.includes(placeholder));
}

export function getSupabaseServerClient():
  | SupabaseClient
  | null {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    return null;
  }

  if (
    !url.startsWith("http") ||
    isPlaceholderValue(url, ["your-project-ref"]) ||
    isPlaceholderValue(serviceRoleKey, ["your-service-role-key"])
  ) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabaseEnvErrorMessage(): string {
  return "Thiếu cấu hình SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.";
}

export function toCardDTO(
  card: CardRow,
  memberEmailById?: Map<string, string>
): CardDTO {
  const assigneeMemberId = card.assignee_member_id;

  return {
    id: card.id,
    title: card.title,
    description: card.description,
    assigneeMemberId,
    assigneeMemberEmail: assigneeMemberId
      ? memberEmailById?.get(assigneeMemberId) ?? null
      : null,
    startDate: card.start_date,
    dueDate: card.due_date,
    position: card.position,
    listId: card.list_id,
  };
}

export function toMemberDTO(member: MemberRow): MemberDTO {
  return {
    id: member.id,
    email: member.email,
  };
}

export function toListDTO(params: {
  list: ListRow;
  cards: CardDTO[];
}): ListDTO {
  const { list, cards } = params;
  return {
    id: list.id,
    title: list.title,
    position: list.position,
    boardId: list.board_id,
    cards,
  };
}

export function toBoardSummary(params: {
  board: BoardRow;
  listsCount: number;
}): BoardSummary {
  const { board, listsCount } = params;
  return {
    id: board.id,
    title: board.title,
    createdAt: board.created_at,
    _count: { lists: listsCount },
  };
}

export function toBoardDTO(params: {
  board: BoardRow;
  lists: ListDTO[];
  members: MemberDTO[];
}): BoardDTO {
  const { board, lists, members } = params;
  return {
    id: board.id,
    title: board.title,
    createdAt: board.created_at,
    lists,
    members,
  };
}
