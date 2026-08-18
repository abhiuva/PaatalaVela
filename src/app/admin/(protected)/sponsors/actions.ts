"use server";

import { revalidatePath } from "next/cache";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/admin/auth";
import { sponsorCampaignInputSchema, sponsorInputSchema } from "@/lib/catalogue/validation";

async function requireAdminWrite() {
  const context = await getAdminContext();
  return { context, supabase: context.status === "ok" ? createServiceSupabaseClient() : null };
}

export async function saveSponsorAction(_previousState: { ok: boolean; message: string } | null, formData: FormData) {
  const { supabase } = await requireAdminWrite();
  if (!supabase) {
    return { ok: false, message: "Unauthorized." };
  }

  const parsed = sponsorInputSchema.safeParse({
    sponsorId: formData.get("sponsorId") || undefined,
    name: formData.get("name"),
    logoUrl: formData.get("logoUrl"),
    websiteUrl: formData.get("websiteUrl"),
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid sponsor." };
  }

  const payload = {
    name: parsed.data.name,
    logo_url: parsed.data.logoUrl,
    website_url: parsed.data.websiteUrl,
    contact_name: parsed.data.contactName || null,
    contact_email: parsed.data.contactEmail || null,
    active: parsed.data.active,
  };
  const result = parsed.data.sponsorId
    ? await supabase.from("sponsors").update(payload).eq("id", parsed.data.sponsorId)
    : await supabase.from("sponsors").insert(payload);

  revalidatePath("/admin/sponsors");
  return result.error ? { ok: false, message: "Unable to save sponsor." } : { ok: true, message: "Sponsor saved." };
}

export async function saveCampaignAction(_previousState: { ok: boolean; message: string } | null, formData: FormData) {
  const { context, supabase } = await requireAdminWrite();
  if (!supabase || context.status !== "ok") {
    return { ok: false, message: "Unauthorized." };
  }

  const parsed = sponsorCampaignInputSchema.safeParse({
    campaignId: formData.get("campaignId") || undefined,
    sponsorId: formData.get("sponsorId"),
    campaignName: formData.get("campaignName"),
    placementType: formData.get("placementType"),
    channelId: formData.get("channelId") || "",
    headline: formData.get("headline"),
    description: formData.get("description"),
    imageUrl: formData.get("imageUrl"),
    destinationUrl: formData.get("destinationUrl"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    priority: formData.get("priority"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid campaign." };
  }
  if (parsed.data.status === "active" && context.profile.role !== "admin") {
    return { ok: false, message: "Only admins may activate campaigns." };
  }

  const payload = {
    sponsor_id: parsed.data.sponsorId,
    campaign_name: parsed.data.campaignName,
    placement_type: parsed.data.placementType,
    channel_id: parsed.data.channelId || null,
    headline: parsed.data.headline,
    description: parsed.data.description || null,
    image_url: parsed.data.imageUrl,
    destination_url: parsed.data.destinationUrl,
    start_at: new Date(parsed.data.startAt).toISOString(),
    end_at: new Date(parsed.data.endAt).toISOString(),
    priority: parsed.data.priority,
    status: parsed.data.status,
  };
  const result = parsed.data.campaignId
    ? await supabase.from("sponsor_campaigns").update(payload).eq("id", parsed.data.campaignId)
    : await supabase.from("sponsor_campaigns").insert(payload);

  revalidatePath("/admin/sponsors");
  revalidatePath("/");
  return result.error ? { ok: false, message: "Unable to save campaign." } : { ok: true, message: "Campaign saved." };
}
