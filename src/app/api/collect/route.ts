export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * CORS headers – public endpoint
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Preflight handler
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * Collect tracking event
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 🔥 IMPORTANT: camelCase (matches utmstitcher.js)
    const {
      siteKey,
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

    /**
     * Validate site key
     */
    const keyHash = crypto
      .createHash("sha256")
      .update(siteKey)
      .digest("hex");

    const { data: keyRow, error: keyErr } = await admin
      .from("site_keys")
      .select("site_id")
      .eq("key_hash", keyHash)
      .is("revoked_at", null)
      .single();

    if (keyErr || !keyRow) {
      return NextResponse.json(
        { error: "Invalid site key" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    /**
     * Insert event — EXACTLY matches your schema
     */
    const { error: insertErr } = await admin.from("events").insert({
      site_id: keyRow.site_id,
      visitor_id: visitorId,
      visit_count: visitCount ?? 1,
      first_touch: firstTouch ?? null,
      last_touch: lastTouch ?? null,
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

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error("Collect fatal error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
