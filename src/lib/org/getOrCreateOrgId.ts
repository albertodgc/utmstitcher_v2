import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function orgNameFromEmail(email?: string | null) {
  if (!email) return "My Org";
  const domain = email.split("@")[1] || "";
  return domain ? domain.split(".")[0] : "My Org";
}

export async function getOrCreateOrgId(user: User) {
  const admin = createSupabaseAdminClient();

  const { data: membership, error: memberErr } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberErr) throw new Error(`Failed to resolve org membership: ${memberErr.message}`);
  if (membership?.org_id) return membership.org_id as string;

  const orgName =
    (user.user_metadata as any)?.org_name ||
    orgNameFromEmail(user.email);

  const { data: org, error: orgErr } = await admin
    .from("orgs")
    .insert({ name: orgName })
    .select("id")
    .single();

  if (orgErr || !org?.id) throw new Error(`Failed to create org: ${orgErr?.message || "unknown"}`);

  const { error: memInsErr } = await admin
    .from("org_members")
    .insert({ org_id: org.id, user_id: user.id, role: "owner" });

  if (memInsErr) throw new Error(`Failed to create org membership: ${memInsErr.message}`);

  return org.id as string;
}
