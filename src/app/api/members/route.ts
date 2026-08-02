import { NextResponse } from "next/server";
import { toMemberDTO } from "@/lib/supabase";
import {
  isValidEmail,
  normalizeEmail,
  requireSupabaseAndMember,
} from "@/lib/server-auth";

export const dynamic = "force-dynamic";

/** List all workspace users (shared across every board). */
export async function GET() {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase } = authContext;
  const { data, error } = await supabase
    .from("members")
    .select("id, email, name, created_at, updated_at")
    .order("email", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data.map((member) => toMemberDTO(member)));
}

/** Create or upsert a workspace user by email. */
export async function POST(request: Request) {
  const authContext = await requireSupabaseAndMember();
  if ("errorResponse" in authContext) {
    return authContext.errorResponse;
  }

  const { supabase } = authContext;
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const name =
    typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
  }

  const payload: { email: string; name?: string | null } = { email };
  if ("name" in body) {
    payload.name = name;
  }

  const { data: member, error } = await supabase
    .from("members")
    .upsert(payload, { onConflict: "email" })
    .select("id, email, name, created_at, updated_at")
    .single();

  if (error || !member) {
    return NextResponse.json(
      { error: error?.message ?? "Không thể tạo người dùng." },
      { status: 500 }
    );
  }

  return NextResponse.json(toMemberDTO(member), { status: 201 });
}
