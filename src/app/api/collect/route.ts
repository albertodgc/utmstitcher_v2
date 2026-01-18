import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Safely parse JSON coming from client
 */
function safeParse(value: any) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "*";

  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };

  try {
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
        headers,
      });
    }

    // 🔐 Validate site key
    const { data: keyRow, error: keyErr } = await supabaseAdmin
      .from("site_keys")
      .select("site_id")
      .eq("public_key", siteKey)
      .single();

    if (keyErr || !keyRow) {
      return new Response("Invalid site key", {
        status: 401,
        headers,
      });
    }

    const siteId = keyRow.site_id;

    // ✅ FIX #1 — parse UTMs as objects
    const firstTouchObj = safeParse(firstTouch);
    const lastTouchObj = safeParse(lastTouch);

    // 🔁 Insert event
    const { error: eventErr } = await supabaseAdmin.from("events").insert({
      site_id: siteId,
      visitor_id: visitorId,
      visit_count: visitCount ?? 1,
      first_touch: firstTouchObj,
      last_touch: lastTouchObj,
      page_path: pagePath ?? null,
      user_agent: userAgent ?? null,
    });

    if (eventErr) {
      console.error("EVENT INSERT ERROR", eventErr);
      return new Response("Failed to insert event", {
        status: 500,
        headers,
      });
    }

    // ✅ FIX #2 — identity stitched HERE (no /identify endpoint)
    if (identity?.email) {
      await supabaseAdmin.from("identities").upsert(
        {
          site_id: siteId,
          visitor_id: visitorId,
          email: identity.email,
          first_name: identity.first_name ?? null,
          last_name: identity.last_name ?? null,
        },
        {
          onConflict: "site_id,visitor_id",
        }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error("COLLECT ERROR", err);
    return new Response("Server error", {
      status: 500,
      headers,
    });
  }
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
    },
  });
}
