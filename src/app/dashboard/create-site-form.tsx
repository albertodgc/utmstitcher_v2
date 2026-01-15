"use client";

import { useState } from "react";

export default function CreateSiteForm() {
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const res = await fetch("/api/sites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain }),
    });

    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  return (
    <section style={{ marginTop: 24 }}>
      <h2>Create a site</h2>

      <form onSubmit={onSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          placeholder="example.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        />
        <button disabled={!domain || loading}>
          {loading ? "Creating…" : "Create"}
        </button>
      </form>

      {result && (
        <pre style={{ marginTop: 16 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </section>
  );
}
