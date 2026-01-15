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
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Handle preflight
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

    const {
      site_key,
      visitor_id,
      visit_count,
      first_touch,
      last_touch,
      page_path,
      user_agent,
    } = body;

    if (!site_key || !visitor_id) {
      return NextResponse.json(
        { error: "Missing site_key or visitor_id" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const admin = createSupabaseAdminClient();

    /**
     * Validate site key
     */
    const keyHash = crypto
      .createHash("sha256")
      .update(site_key)
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
     * Insert event (MATCHES SCHEMA)
     */
    const { error: insertErr } = await admin.from("events").insert({
      site_id: keyRow.site_id,
      visitor_id,
      visit_count: visit_count ?? 1,
      first_touch: first_touch ?? null,
      last_touch: last_touch ?? null,
      page_path_id: page_path ?? null,
      user_agent: user_agent ?? null,
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
