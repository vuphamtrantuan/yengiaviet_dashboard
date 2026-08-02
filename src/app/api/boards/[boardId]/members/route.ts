import { NextResponse } from "next/server";
import { toMemberDTO } from "@/lib/supabase";
import {
  ensureBoardExists,
  isValidEmail,
  normalizeEmail,
  requireSupabaseAndMember,
} from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/**
 * Compatibility endpoint: boards share the global workspace member list.
 * Prefer /api/members for user management.
 */
export async function GET(
  _request: Request,
  { params }: { params: { boardId: string } }
) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase } = authContext;
  const boardExistsError = await ensureBoardExists({
    supabase,
    boardId: params.boardId,
  });
  if (boardExistsError) {
    return boardExistsError;
  }

  const { data: members, error } = await supabase
    .from("members")
    .select("id, email, name, created_at, updated_at")
    .order("email", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(members.map((item) => toMemberDTO(item)));
}

/** Invite/create a workspace user (shared across all boards). */
export async function POST(
  request: Request,
  { params }: { params: { boardId: string } }
) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase } = authContext;
  const boardExistsError = await ensureBoardExists({
    supabase,
    boardId: params.boardId,
  });
  if (boardExistsError) {
    return boardExistsError;
  }

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
  }

  const { data: newMember, error: newMemberError } = await supabase
    .from("members")
    .upsert({ email }, { onConflict: "email" })
    .select("id, email, name, created_at, updated_at")
    .single();

  if (newMemberError || !newMember) {
    return NextResponse.json(
      { error: newMemberError?.message ?? "Không thể thêm thành viên." },
      { status: 500 }
    );
  }

  await supabase.from("board_members").upsert(
    {
      board_id: params.boardId,
      member_id: newMember.id,
    },
    { onConflict: "board_id,member_id" }
  );

  return NextResponse.json({ member: toMemberDTO(newMember) }, { status: 201 });
}
