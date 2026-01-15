import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

async function getVisitors(siteId: string) {
  const res = await fetch(
    `${process.env.APP_URL}/api/visitors?site_id=${siteId}`,
    { cache: "no-store" }
  );
  return res.json();
}

export default async function SitePage({ params }: any) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await getVisitors(params.siteId);

  return (
    <main style={{ padding: 24 }}>
      <h1>Visitors</h1>

      {!data.ok && <pre>{JSON.stringify(data, null, 2)}</pre>}

      {data.ok && (
        <table border={1} cellPadding={6}>
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
            {data.visitors.map((v: any) => (
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
