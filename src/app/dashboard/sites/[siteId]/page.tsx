export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOrCreateOrgId } from "@/lib/org/getOrCreateOrgId";

type PageProps = {
  params: Promise<{
    siteId: string;
  }>;
};

export default async function SitePage({ params }: PageProps) {
  const { siteId } = await params;

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const orgId = await getOrCreateOrgId(user);

  // Load site (ownership enforced)
  const { data: site, error: siteErr } = await supabase
    .from("sites")
    .select("id, domain")
    .eq("id", siteId)
    .eq("org_id", orgId)
    .single();

  if (siteErr) {
    return <pre>{siteErr.message}</pre>;
  }

  if (!site) {
    return <main style={{ padding: 24 }}>Site not found.</main>;
  }

  // Load site API key (first active key)
  const { data: siteKeyRow, error: keyErr } = await admin
    .from("site_keys")
    .select("api_key")
    .eq("site_id", site.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (keyErr) {
    return <pre>{keyErr.message}</pre>;
  }

  const siteKey = siteKeyRow?.api_key;

  // Load events (NO identity fields here)
  const { data: events, error: eventsErr } = await admin
    .from("events")
    .select("visitor_id, first_touch, last_touch, visit_count, created_at")
    .eq("site_id", site.id)
    .order("created_at", { ascending: false });

  if (eventsErr) {
    return <pre>{eventsErr.message}</pre>;
  }

  // Load identities separately
  const { data: identities, error: identitiesErr } = await admin
    .from("identities")
    .select("visitor_id, email, first_name, last_name")
    .eq("site_id", site.id);

  if (identitiesErr) {
    return <pre>{identitiesErr.message}</pre>;
  }

  // Build identity lookup
  const identityMap = new Map(
    (identities || []).map((i) => [i.visitor_id, i])
  );

  // Aggregate visitors
  const visitorsMap = new Map<string, any>();

  for (const e of events || []) {
    if (!visitorsMap.has(e.visitor_id)) {
      const identity = identityMap.get(e.visitor_id);

      visitorsMap.set(e.visitor_id, {
        visitor_id: e.visitor_id,
        email: identity?.email || null,
        first_name: identity?.first_name || null,
        last_name: identity?.last_name || null,
        first_touch: e.first_touch,
        last_touch: e.last_touch,
        visit_count: e.visit_count || 1,
        last_seen_at: e.created_at,
      });
    }
  }

  const visitors = Array.from(visitorsMap.values());

  return (
    <main style={{ padding: 24 }}>
      <h1>{site.domain}</h1>

      <h2 style={{ marginTop: 24 }}>Tracking snippet</h2>
      <pre>
        {`<script src="https://app.utmstitcher.com/utmstitcher.js" data-site="${siteKey}"></script>`}
      </pre>

      <h2 style={{ marginTop: 32 }}>Visitors</h2>

      {visitors.length === 0 ? (
        <p>No visitors yet.</p>
      ) : (
        <table border={1} cellPadding={6} cellSpacing={0}>
          <thead>
            <tr>
              <th>Visitor</th>
              <th>Email</th>
              <th>Name</th>
              <th>First Touch</th>
              <th>Last Touch</th>
              <th>Visits</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {visitors.map((v) => (
              <tr key={v.visitor_id}>
                <td>{v.visitor_id.slice(0, 8)}…</td>
                <td>{v.email || "-"}</td>
                <td>
                  {v.first_name || v.last_name
                    ? `${v.first_name ?? ""} ${v.last_name ?? ""}`
                    : "-"}
                </td>
                <td>{v.first_touch?.utm_source || "-"}</td>
                <td>{v.last_touch?.utm_source || "-"}</td>
                <td>{v.visit_count}</td>
                <td>{new Date(v.last_seen_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
