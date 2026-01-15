import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import Link from "next/link";

async function getSites() {
  const res = await fetch(`${process.env.APP_URL}/api/sites`, {
    cache: "no-store",
  });
  return res.json();
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const data = await getSites();

  return (
    <main style={{ padding: 24 }}>
      <h1>Dashboard</h1>

      <h2 style={{ marginTop: 24 }}>Your sites</h2>

      {data?.ok && data.sites.length === 0 && <p>No sites yet.</p>}

      {data?.ok && data.sites.length > 0 && (
        <ul>
          {data.sites.map((site: any) => (
            <li key={site.id} style={{ marginBottom: 8 }}>
              <b>{site.domain}</b>{" "}
              <Link href={`/dashboard/sites/${site.id}`}>View</Link>
            </li>
          ))}
        </ul>
      )}

      {!data?.ok && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </main>
  );
}
