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
    .select("id, email, created_at, updated_at")
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

  return { supabase, member };
}

export async function ensureBoardMembership(params: {
  supabase: ServerSupabase;
  boardId: string;
  memberId: string;
}): Promise<NextResponse | null> {
  const { supabase, boardId, memberId } = params;
  const { data, error } = await supabase
    .from("board_members")
    .select("board_id")
    .eq("board_id", boardId)
    .eq("member_id", memberId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Bạn không có quyền truy cập bảng này." },
      { status: 403 }
    );
  }

  return null;
}
