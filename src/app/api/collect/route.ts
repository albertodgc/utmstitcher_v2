import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    // ✅ Create client INSIDE handler (runtime-safe)
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await req.json();

    const {
      siteKey,
      visitorId,
      visitCount,
      firstTouch,
      lastTouch,
      pagePath,
      userAgent,
      identity,
    } = body;

    if (!siteKey || !visitorId) {
      return new Response("Missing siteKey or visitorId", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // ------------------------------------
    // 1️⃣ Validate site key
    // ------------------------------------
    const { data: keyRow, error: keyErr } = await supabaseAdmin
      .from("site_keys")
      .select("site_id")
      .eq("api_key", siteKey)
      .is("revoked_at", null)
      .single();

    if (keyErr || !keyRow) {
      return new Response("Invalid site key", {
        status: 401,
        headers: corsHeaders,
      });
    }

    const siteId = keyRow.site_id;

    // ------------------------------------
    // 2️⃣ Resolve immutable first touch
    // ------------------------------------
    const { data: firstEvent } = await supabaseAdmin
      .from("events")
      .select("first_touch")
      .eq("site_id", siteId)
      .eq("visitor_id", visitorId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const resolvedFirstTouch =
      firstEvent?.first_touch ?? firstTouch ?? null;

    const resolvedLastTouch = lastTouch ?? null;

    // ------------------------------------
    // 3️⃣ Insert event (append-only)
    // ------------------------------------
    await supabaseAdmin.from("events").insert({
      site_id: siteId,
      visitor_id: visitorId,
      page_path: pagePath,
      user_agent: userAgent,
      visit_count: visitCount,
      first_touch: resolvedFirstTouch,
      last_touch: resolvedLastTouch,
    });

    // ------------------------------------
    // 4️⃣ Identity stitching (idempotent)
    // ------------------------------------
    if (identity?.email) {
      await supabaseAdmin
        .from("identities")
        .upsert(
          {
            site_id: siteId,
            visitor_id: visitorId,
            email: identity.email,
            first_name: identity.first_name ?? null,
            last_name: identity.last_name ?? null,
          },
          {
            onConflict: "site_id,visitor_id,email",
          }
        );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("collect error:", err);
    return new Response("Server error", {
      status: 500,
      headers: corsHeaders,
    });
  }
}
