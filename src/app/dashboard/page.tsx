import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main>
      <h1>Dashboard</h1>

      <form action="/logout" method="post">
        <button type="submit">Logout</button>
      </form>

      <pre>{JSON.stringify(user, null, 2)}</pre>
    </main>
  );
}
