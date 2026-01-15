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

  // 1) Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 2) Org
  const orgId = await getOrCreateOrgId(user);

  // 3) Site ownership
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id, domain")
    .eq("id", siteId)
    .eq("org_id", orgId)
    .single();

  if (siteError || !site) {
    return <main style={{ padding: 24 }}>Site not found.</main>;
  }

  // 4) Load site key (admin)
  const { data: siteKeyRow, error: keyError } = await admin
    .from("site_keys")
    .select("api_key")
    .eq("site_id", site.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (keyError || !siteKeyRow) {
    return (
      <main style={{ padding: 24 }}>
        <p>No site key found.</p>
      </main>
    );
  }

  const siteKey = siteKeyRow.api_key;

  // 5) Load events
  const { data: events } = await admin
    .from("events")
    .select("visitor_id, first_touch, last_touch, visit_count, created_at")
    .eq("site_id", site.id)
    .order("created_at", { ascending: false });

  // 6) Aggregate visitors
  const visitorsMap = new Map<string, any>();

  for (const e of events || []) {
    if (!visitorsMap.has(e.visitor_id)) {
      visitorsMap.set(e.visitor_id, {
        visitor_id: e.visitor_id,
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

      <h2>Tracking snippet</h2>
      <pre>
        {`<script src="https://app.utmstitcher.com/utmstitcher.js" data-site="${siteKey}"></script>`}
      </pre>


      <p>
        <strong>Site ID:</strong> {site.id}
      </p>

      <h2 style={{ marginTop: 32 }}>Visitors</h2>

      {visitors.length === 0 ? (
        <p>No visitors yet.</p>
      ) : (
        <table border={1} cellPadding={6} cellSpacing={0}>
          <thead>
            <tr>
              <th>Visitor</th>
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
