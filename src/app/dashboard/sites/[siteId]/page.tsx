import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function SiteDashboard({
  params,
}: {
  params: { siteId: string };
}) {
  const siteId = params.siteId;

  // 1. Load site
  const { data: site } = await admin
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .single();

  if (!site) {
    return <p>Site not found</p>;
  }

  // 2. Load site key (for snippet)
  const { data: siteKeyRow } = await admin
    .from("site_keys")
    .select("api_key")
    .eq("site_id", site.id)
    .is("revoked_at", null)
    .single();

  const siteKey = siteKeyRow?.api_key;

  // 3. Load events
  const { data: events, error: eventsErr } = await admin
    .from("events")
    .select(
      "visitor_id, first_touch, last_touch, visit_count, created_at"
    )
    .eq("site_id", site.id)
    .order("created_at", { ascending: false });

  if (eventsErr) {
    return <pre>{eventsErr.message}</pre>;
  }

  // 4. Load identities
  const { data: identities } = await admin
    .from("identities")
    .select("visitor_id, email, first_name, last_name")
    .eq("site_id", site.id);

  const identityMap = new Map(
    (identities || []).map((i) => [i.visitor_id, i])
  );

  // 5. Merge into visitors
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
    <main style={{ padding: 32, maxWidth: 1200 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>
        {site.domain}
      </h1>

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
      </section>

      {/* Visitors */}
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
              <tr
                style={{
                  textAlign: "left",
                  borderBottom: "1px solid #333",
                }}
              >
                <th style={{ padding: "8px 6px" }}>Visitor</th>
                <th style={{ padding: "8px 6px" }}>Email</th>
                <th style={{ padding: "8px 6px" }}>Name</th>
                <th style={{ padding: "8px 6px" }}>Landing Page</th>
                <th style={{ padding: "8px 6px" }}>UTM Source</th>
                <th style={{ padding: "8px 6px" }}>UTM Medium</th>
                <th style={{ padding: "8px 6px" }}>UTM Campaign</th>
                <th style={{ padding: "8px 6px" }}>Visits</th>
                <th style={{ padding: "8px 6px" }}>Last Seen</th>
              </tr>
            </thead>

            <tbody>
              {visitors.map((v, idx) => (
                <tr
                  key={v.visitor_id}
                  style={{
                    background:
                      idx % 2 === 0 ? "transparent" : "#0d0d0d",
                    borderBottom: "1px solid #222",
                  }}
                >
                  <td
                    style={{
                      padding: "8px 6px",
                      fontFamily: "monospace",
                    }}
                  >
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

                  <td
                    style={{
                      padding: "8px 6px",
                      fontFamily: "monospace",
                      maxWidth: 260,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={v.first_touch?.landing_page}
                  >
                    {v.first_touch?.landing_page || "-"}
                  </td>

                  <td style={{ padding: "8px 6px" }}>
                    {v.first_touch?.utm_source || "-"}
                  </td>

                  <td style={{ padding: "8px 6px" }}>
                    {v.first_touch?.utm_medium || "-"}
                  </td>

                  <td style={{ padding: "8px 6px" }}>
                    {v.first_touch?.utm_campaign || "-"}
                  </td>

                  <td
                    style={{
                      padding: "8px 6px",
                      textAlign: "center",
                    }}
                  >
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
