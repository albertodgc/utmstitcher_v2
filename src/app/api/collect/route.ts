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
      siteKey,        // api key from script
      visitorId,
      visitCount,
      firstTouch,
      lastTouch,
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

    // 1. Resolve site_id from api key
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

    // 2. Insert event
    const { error: insertErr } = await admin.from("events").insert({
      site_id: keyRow.site_id,
      visitor_id: visitorId,
      visit_count: visitCount ?? 1,
      first_touch: firstTouch ?? null,
      last_touch: lastTouch ?? null,
      page_path: pagePath ?? null,
      user_agent: userAgent ?? null,
    });

    if (insertErr) throw insertErr;

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("Collect error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
