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

  // Load events
  const { data: events, error: eventsErr } = await admin
    .from("events")
    .select("visitor_id, first_touch, last_touch, visit_count, created_at")
    .eq("site_id", site.id)
    .order("created_at", { ascending: false });

  if (eventsErr) {
    return <pre>{eventsErr.message}</pre>;
  }

  // Load identities
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

  // --- Step 2: Summary stats ---
  const trackedVisitors = visitors.length;

  const identifiedLeads = visitors.filter((v) => !!v.email).length;

  const identifiedWithUtm = visitors.filter((v) => {
    if (!v.email) return false;

    const ft = v.first_touch || {};
    const lt = v.last_touch || {};

    // "Has UTM data" = has any UTM field present (first or last)
    const hasAnyUtm =
      !!ft.utm_source ||
      !!ft.utm_medium ||
      !!ft.utm_campaign ||
      !!ft.utm_term ||
      !!ft.utm_content ||
      !!lt.utm_source ||
      !!lt.utm_medium ||
      !!lt.utm_campaign ||
      !!lt.utm_term ||
      !!lt.utm_content;

    return hasAnyUtm;
  }).length;

  const utmCoveragePct =
    identifiedLeads === 0 ? 0 : Math.round((identifiedWithUtm / identifiedLeads) * 100);


  return (
    <main style={{ padding: 32, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>
        {site.domain}
      </h1>

      <section
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid #222",
          borderRadius: 8,
          background: "#0b0b0b",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Tracked visitors</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{trackedVisitors}</div>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Identified leads</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{identifiedLeads}</div>
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Leads with UTM data</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{utmCoveragePct}%</div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
            ({identifiedWithUtm}/{identifiedLeads})
          </div>
        </div>
      </section>


      {/* Tracking snippet */}
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>
          Tracking snippet
        </h2>

        <pre
          style={{
            background: "#111",
            border: "1px solid #333",
            padding: 12,
            borderRadius: 6,
            overflowX: "auto",
            fontSize: 13,
          }}
        >
          {`<script src="https://app.utmstitcher.com/utmstitcher.js" data-site="${siteKey}"></script>`}
        </pre>

        {/* EXPORT BUTTON — STEP 1 */}
        <a
          href={`/api/export/hubspot?site_id=${site.id}`}
          style={{
            display: "inline-block",
            marginTop: 12,
            padding: "8px 12px",
            background: "#2563eb",
            color: "#fff",
            borderRadius: 4,
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          Export HubSpot CSV
        </a>
      </section>

      {/* Visitors table */}
      <section style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>
          Visitors
        </h2>

        {visitors.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No visitors yet.</p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #333" }}>
                <th style={{ padding: "8px 6px" }}>Visitor</th>
                <th style={{ padding: "8px 6px" }}>Email</th>
                <th style={{ padding: "8px 6px" }}>Name</th>
                <th style={{ padding: "8px 6px" }}>First Touch</th>
                <th style={{ padding: "8px 6px" }}>Last Touch</th>
                <th style={{ padding: "8px 6px" }}>Visits</th>
                <th style={{ padding: "8px 6px" }}>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((v, idx) => (
                <tr
                  key={v.visitor_id}
                  style={{
                    background: idx % 2 === 0 ? "transparent" : "#0d0d0d",
                    borderBottom: "1px solid #222",
                  }}
                >
                  <td style={{ padding: "8px 6px", fontFamily: "monospace" }}>
                    {v.visitor_id.slice(0, 8)}…
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    {v.email || "-"}
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    {v.first_name || v.last_name
                      ? `${v.first_name ?? ""} ${v.last_name ?? ""}`
                      : "-"}
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    {v.first_touch?.utm_source || "-"}
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    {v.last_touch?.utm_source || "-"}
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "center" }}>
                    {v.visit_count}
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    {new Date(v.last_seen_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
