export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOrgId } from "@/lib/org/getOrCreateOrgId";

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normalizeDomain(domain: string) {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, ""); // drop paths
}

function generateApiKey() {
  return crypto.randomBytes(32).toString("hex"); // 64 chars
}

function snippet(appUrl: string, apiKey: string) {
  // You’ll create /utmstitcher.js in Step 5
  return `<script src="${appUrl.replace(/\/$/, "")}/utmstitcher.js" data-site="${apiKey}"></script>`;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) {
    return NextResponse.json({ ok: false, error: userErr.message }, { status: 401 });
  }
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const orgId = await getOrCreateOrgId(user);

  const { data: sites, error } = await admin
    .from("sites")
    .select("id, org_id, name, domain, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sites: sites ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const rawDomain = typeof body.domain === "string" ? body.domain : "";
  const domain = normalizeDomain(rawDomain);

  if (!domain) {
    return NextResponse.json({ ok: false, error: "Missing domain" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : null;

  const admin = createSupabaseAdminClient();
  const orgId = await getOrCreateOrgId(user);

  // 1) Create site
  const { data: site, error: siteErr } = await admin
    .from("sites")
    .insert({
      org_id: orgId,
      domain,
      name,
    })
    .select("id, org_id, domain, name, created_at")
    .single();

  if (siteErr || !site?.id) {
    // Handle unique constraint on (org_id, domain)
    return NextResponse.json(
      { ok: false, error: siteErr?.message || "Failed to create site" },
      { status: 400 }
    );
  }

  // 2) Create API key for that site
  const apiKey = generateApiKey();
  const keyHash = sha256Hex(apiKey);

  const { error: keyErr } = await admin.from("site_keys").insert({
    site_id: site.id,
    api_key: apiKey,  // optional; you can store only hash later
    key_hash: keyHash,
    label: "default",
  });

  if (keyErr) {
    // Roll back site if key creation fails
    await admin.from("sites").delete().eq("id", site.id);
    return NextResponse.json({ ok: false, error: keyErr.message }, { status: 500 });
  }

  const appUrl = process.env.APP_URL || "http://localhost:3000";

  return NextResponse.json({
    ok: true,
    site,
    apiKey,
    apiKeyPrefix: apiKey.slice(0, 6),
    snippet: snippet(appUrl, apiKey),
  });
}

export async function DELETE(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const siteId = url.searchParams.get("id");

  if (!siteId) {
    return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const orgId = await getOrCreateOrgId(user);

  // Ensure user owns it (org match)
  const { data: site, error: siteLookupErr } = await admin
    .from("sites")
    .select("id, org_id")
    .eq("id", siteId)
    .maybeSingle();

  if (siteLookupErr) {
    return NextResponse.json({ ok: false, error: siteLookupErr.message }, { status: 500 });
  }
  if (!site || site.org_id !== orgId) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const { error: delErr } = await admin.from("sites").delete().eq("id", siteId);
  if (delErr) {
    return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
