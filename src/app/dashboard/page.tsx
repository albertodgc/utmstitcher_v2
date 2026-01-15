import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateOrgId } from "@/lib/org/getOrCreateOrgId";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const orgId = await getOrCreateOrgId(user);

  const { data: sites, error } = await supabase
    .from("sites")
    .select("id, domain, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    return <pre>{error.message}</pre>;
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Dashboard</h1>

      <h2 style={{ marginTop: 24 }}>Your sites</h2>

      {sites?.length === 0 && <p>No sites yet.</p>}

      <ul>
        {sites?.map((site) => (
          <li key={site.id}>
            <b>{site.domain}</b>{" "}
            <Link href={`/dashboard/sites/${site.id}`}>View</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
