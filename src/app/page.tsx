import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className="p-8">
      <h1 className="text-xl font-bold">Auth check</h1>
      <pre className="mt-4 text-sm">
        {JSON.stringify(user, null, 2)}
      </pre>
    </main>
  );
}
