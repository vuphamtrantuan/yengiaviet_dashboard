import { NextResponse } from "next/server";
import {
  getSupabaseEnvErrorMessage,
  getSupabaseServerClient,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { listId: string } }
) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: getSupabaseEnvErrorMessage() },
      { status: 500 }
    );
  }

  const { error } = await supabase.from("lists").delete().eq("id", params.listId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
