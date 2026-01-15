import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normalizeDomain(domain?: string | null) {
  if (!domain) return null;
  return domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase().trim();
}

export async function POST(req: Request) {
  const admin = createSupabaseAdminClient();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const siteKey = typeof body.siteKey === "string" ? body.siteKey.trim() : null;
  const visitorId = body.visitorId ? String(body.visitorId) : null;

  if (!siteKey) return NextResponse.json({ ok: false, error: "Missing siteKey" }, { status: 401 });
  if (!visitorId) return NextResponse.json({ ok: false, error: "Missing visitorId" }, { status: 400 });

  // 1) Resolve site_id from site_keys (raw or hashed)
  const keyHash = sha256Hex(siteKey);

  const { data: keyRow, error: keyErr } = await admin
    .from("site_keys")
    .select("site_id, revoked_at")
    .or(`api_key.eq.${siteKey},key_hash.eq.${keyHash}`)
    .maybeSingle();

  if (keyErr) return NextResponse.json({ ok: false, error: "Key lookup failed" }, { status: 500 });
  if (!keyRow?.site_id) return NextResponse.json({ ok: false, error: "Invalid siteKey" }, { status: 401 });
  if (keyRow.revoked_at) return NextResponse.json({ ok: false, error: "siteKey revoked" }, { status: 401 });

  const siteId = keyRow.site_id;

  // 2) Enforce origin domain match (best-effort)
  const { data: siteRow, error: siteErr } = await admin
    .from("sites")
    .select("id, domain")
    .eq("id", siteId)
    .maybeSingle();

  if (siteErr || !siteRow?.id) {
    return NextResponse.json({ ok: false, error: "Site lookup failed" }, { status: 500 });
  }

  const siteDomain = normalizeDomain(siteRow.domain);
  const requestUrl = new URL(req.url);
  const origin = req.headers.get("origin");
  const originDomain = origin ? normalizeDomain(origin) : null;

  // If we can detect origin, enforce it.
  if (originDomain && siteDomain && originDomain !== siteDomain) {
    return NextResponse.json(
      { ok: false, error: "Origin domain not allowed for this site", originDomain, siteDomain },
      { status: 403 }
    );
  }

  // 3) Insert raw event (firstTouch/lastTouch are JSON)
  const eventPayload = {
    site_id: siteId,
    site_domain: siteDomain,
    visitor_id: visitorId,
    visit_count: body.visitCount ?? 1,
    first_touch: body.firstTouch ?? null,
    last_touch: body.lastTouch ?? null,
    page_path: body.pagePath ?? null,
    user_agent: body.userAgent ?? null,
  };

  const { data: inserted, error: insErr } = await admin
    .from("events")
    .insert(eventPayload)
    .select("id, site_id, created_at")
    .single();

  if (insErr) {
    return NextResponse.json({ ok: false, error: insErr.message || "Supabase error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted });
}
