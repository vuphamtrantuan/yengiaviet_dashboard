import { NextResponse } from "next/server";
import {
  type BoardMemberRow,
  type MemberRow,
  toMemberDTO,
} from "@/lib/supabase";
import {
  ensureBoardMembership,
  isValidEmail,
  normalizeEmail,
  requireSupabaseAndMember,
} from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { boardId: string } }
) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase, member } = authContext;
  const boardMembershipError = await ensureBoardMembership({
    supabase,
    boardId: params.boardId,
    memberId: member.id,
  });
  if (boardMembershipError) {
    return boardMembershipError;
  }

  const { data: boardMembers, error: boardMembersError } = await supabase
    .from("board_members")
    .select("board_id, member_id, created_at")
    .eq("board_id", params.boardId);

  if (boardMembersError) {
    return NextResponse.json({ error: boardMembersError.message }, { status: 500 });
  }

  const memberIds = boardMembers.map(
    (boardMember: BoardMemberRow) => boardMember.member_id
  );
  if (memberIds.length === 0) {
    return NextResponse.json([]);
  }

  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("id, email, created_at, updated_at")
    .in("id", memberIds);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  return NextResponse.json(
    members.map((item: MemberRow) => toMemberDTO(item))
  );
}

export async function POST(
  request: Request,
  { params }: { params: { boardId: string } }
) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase, member } = authContext;
  const boardMembershipError = await ensureBoardMembership({
    supabase,
    boardId: params.boardId,
    memberId: member.id,
  });
  if (boardMembershipError) {
    return boardMembershipError;
  }

  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
  }

  const { data: newMember, error: newMemberError } = await supabase
    .from("members")
    .upsert({ email }, { onConflict: "email" })
    .select("id, email, created_at, updated_at")
    .single();

  if (newMemberError || !newMember) {
    return NextResponse.json(
      { error: newMemberError?.message ?? "Không thể thêm thành viên." },
      { status: 500 }
    );
  }

  const { error: relationError } = await supabase.from("board_members").upsert(
    {
      board_id: params.boardId,
      member_id: newMember.id,
    },
    { onConflict: "board_id,member_id" }
  );

  if (relationError) {
    return NextResponse.json({ error: relationError.message }, { status: 500 });
  }

  return NextResponse.json({ member: toMemberDTO(newMember) }, { status: 201 });
}
