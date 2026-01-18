export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOrgId } from "@/lib/org/getOrCreateOrgId";

function csvEscape(v: any) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const siteId = new URL(req.url).searchParams.get("site_id");
  if (!siteId) return NextResponse.json({ error: "Missing site_id" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const orgId = await getOrCreateOrgId(user);

  const { data: site } = await admin
    .from("sites")
    .select("id")
    .eq("id", siteId)
    .eq("org_id", orgId)
    .single();

  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: identities } = await admin
    .from("identities")
    .select("visitor_id, email")
    .eq("site_id", siteId)
    .not("email", "is", null);

  if (!identities || identities.length === 0) {
    return NextResponse.json(
      {
        error: "No identified visitors",
        hint: "Submit a HubSpot form with an email to enable CSV export",
      },
      { status: 400 }
    );
  }

  const visitorIds = identities.map(i => i.visitor_id);

  const { data: events } = await admin
    .from("events")
    .select("visitor_id, first_touch, last_touch, visit_count, created_at")
    .eq("site_id", siteId)
    .in("visitor_id", visitorIds)
    .order("created_at", { ascending: true });

  const map = new Map<string, any>();

  for (const e of events || []) {
    if (!map.has(e.visitor_id)) {
      map.set(e.visitor_id, {
        first_touch: e.first_touch,
        last_touch: e.last_touch,
        first_seen_at: e.created_at,
        last_seen_at: e.created_at,
        visit_count: e.visit_count || 1,
      });
    } else {
      const r = map.get(e.visitor_id);
      r.last_seen_at = e.created_at;
      r.visit_count = Math.max(r.visit_count, e.visit_count || 1);
    }
  }

  const rows = [
    [
      "email",
      "utm_source__first",
      "utm_medium__first",
      "utm_campaign__first",
      "utm_term__first",
      "utm_content__first",
      "utm_source__last",
      "utm_medium__last",
      "utm_campaign__last",
      "utm_term__last",
      "utm_content__last",
      "landing_url",
      "first_seen_at",
      "last_seen_at",
      "visit_count",
    ].join(","),
  ];

  for (const i of identities) {
    const e = map.get(i.visitor_id);
    if (!e) continue;

    const ft = e.first_touch || {};
    const lt = e.last_touch || {};

    rows.push([
      i.email,
      ft.utm_source,
      ft.utm_medium,
      ft.utm_campaign,
      ft.utm_term,
      ft.utm_content,
      lt.utm_source,
      lt.utm_medium,
      lt.utm_campaign,
      lt.utm_term,
      lt.utm_content,
      ft.landing_page,
      e.first_seen_at,
      e.last_seen_at,
      e.visit_count,
    ].map(csvEscape).join(","));
  }

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="utmstitcher-hubspot-${siteId}.csv"`,
    },
  });
}
