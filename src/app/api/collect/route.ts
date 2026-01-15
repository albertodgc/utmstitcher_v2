export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      siteKey,
      visitorId,
      visitCount,
      firstTouch,
      lastTouch,
      landingUrl,
      referrer,
      identity,
      pagePath,
      userAgent,
    } = body;

    if (!siteKey || !visitorId) {
      return NextResponse.json(
        { error: "Missing siteKey or visitorId" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const admin = createSupabaseAdminClient();

    const keyHash = sha256Hex(siteKey);

    const { data: keyRow, error: keyErr } = await admin
      .from("site_keys")
      .select("site_id")
      .eq("key_hash", keyHash)
      .single();

    if (keyErr || !keyRow) {
      return NextResponse.json(
        { error: "Invalid site key" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const { error: insertErr } = await admin.from("events").insert({
      site_id: keyRow.site_id,
      visitor_id: visitorId,
      visit_count: visitCount ?? 1,
      first_touch: firstTouch ?? null,
      last_touch: lastTouch ?? null,
      landing_url: landingUrl ?? null,
      referrer: referrer ?? null,
      email: identity?.email ?? null,
      first_name: identity?.first_name ?? null,
      last_name: identity?.last_name ?? null,
      page_path: pagePath ?? null,
      user_agent: userAgent ?? null,
    });

    if (insertErr) {
        console.error("Supabase insert error:", insertErr);
        return NextResponse.json(
          { error: insertErr.message },
          { status: 500, headers: CORS_HEADERS }
        );
      }
      

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (err: any) {
    console.error("Collect fatal error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }  
}
