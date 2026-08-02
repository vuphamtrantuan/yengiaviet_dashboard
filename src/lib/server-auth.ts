import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  type MemberRow,
  getSupabaseEnvErrorMessage,
  getSupabaseServerClient,
} from "@/lib/supabase";

export const SESSION_COOKIE_NAME = "taskflow_member_id";
type ServerSupabase = Exclude<ReturnType<typeof getSupabaseServerClient>, null>;

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Require a configured Supabase client and a valid session cookie member.
 * Boards are shared workspace-wide, so membership checks are not needed here.
 */
export async function requireSupabaseAndMember(): Promise<
  | {
      supabase: ServerSupabase;
      member: MemberRow;
    }
  | { errorResponse: NextResponse }
> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      errorResponse: NextResponse.json(
        { error: getSupabaseEnvErrorMessage() },
        { status: 500 }
      ),
    };
  }

  const memberId = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!memberId) {
    return {
      errorResponse: NextResponse.json(
        { error: "Vui lòng đăng nhập bằng email để tiếp tục." },
        { status: 401 }
      ),
    };
  }

  const { data: member, error } = await supabase
    .from("members")
    .select("id, email, name, created_at, updated_at")
    .eq("id", memberId)
    .single();

  if (error || !member) {
    cookies().delete(SESSION_COOKIE_NAME);
    return {
      errorResponse: NextResponse.json(
        { error: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại." },
        { status: 401 }
      ),
    };
  }

  return { supabase, member: member as MemberRow };
}

/**
 * Ensure a board exists. All authenticated users share the same boards.
 * Returns a 404 response when the board is missing.
 */
export async function ensureBoardExists(params: {
  supabase: ServerSupabase;
  boardId: string;
}): Promise<NextResponse | null> {
  const { supabase, boardId } = params;
  const { data, error } = await supabase
    .from("boards")
    .select("id")
    .eq("id", boardId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Không tìm thấy bảng." }, { status: 404 });
  }

  return null;
}

/**
 * Ensure an assignee exists in the shared workspace members table.
 */
export async function ensureMemberExists(params: {
  supabase: ServerSupabase;
  memberId: string;
}): Promise<NextResponse | null> {
  const { supabase, memberId } = params;
  const { data, error } = await supabase
    .from("members")
    .select("id")
    .eq("id", memberId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Không tìm thấy thành viên được giao việc." },
      { status: 400 }
    );
  }

  return null;
}
