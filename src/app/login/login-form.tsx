"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  const signIn = async () => {
    setStatus("sending");
    setMessage(null);

    const supabase = supabaseBrowser();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Magic link sent. Check your inbox.");
  };

  return (
    <div style={{ marginTop: 16 }}>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        style={{ width: "100%", padding: 10 }}
      />
      <button
        onClick={signIn}
        disabled={!email || status === "sending"}
        style={{ marginTop: 10, width: "100%", padding: 10 }}
      >
        {status === "sending" ? "Sending..." : "Send magic link"}
      </button>

      {message ? <p style={{ marginTop: 10 }}>{message}</p> : null}
    </div>
  );
}
