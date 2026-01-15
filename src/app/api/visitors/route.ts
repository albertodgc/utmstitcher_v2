export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const siteId = url.searchParams.get("site_id");

  if (!siteId) {
    return NextResponse.json({ ok: false, error: "Missing site_id" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("events")
    .select("visitor_id, first_touch, last_touch, visit_count, created_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const map = new Map();

  for (const e of data || []) {
    if (!map.has(e.visitor_id)) {
      map.set(e.visitor_id, {
        visitor_id: e.visitor_id,
        first_touch: e.first_touch,
        last_touch: e.last_touch,
        visit_count: e.visit_count || 1,
        last_seen_at: e.created_at,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    visitors: Array.from(map.values()),
  });
}
