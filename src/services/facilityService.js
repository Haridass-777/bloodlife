import { supabase } from "../lib/supabase";

export async function getVerifiedFacilities() {
  const { data, error } = await supabase
    .from("facilities")
    .select("id, facility_name, city, facility_type")
    .eq("verification_status", "verified")
    .order("facility_name");

  if (error) throw error;
  return data;
}

// Full profile for the logged-in facility's own dashboard.
export async function getFacilityById(facilityId) {
  const { data, error } = await supabase
    .from("facilities")
    .select("*")
    .eq("id", facilityId)
    .single();

  if (error) throw error;
  return data;
}

// Editable fields only — verification_status/verified_by/verified_at
// are intentionally left out; only the verification team should touch those.
export async function updateFacility(facilityId, updates) {
  const allowed = [
    "phone",
    "emergency_contact",
    "address",
    "location_name",
    "google_map_link",
    "blood_bank_available",
    "emergency_services",
    "trauma_center",
    "operating_24x7",
    "total_beds",
    "accepts_emergency_requests",
  ];
  const payload = {};
  for (const key of allowed) {
    if (key in updates) payload[key] = updates[key];
  }
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("facilities")
    .update(payload)
    .eq("id", facilityId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
