import { supabase } from "../lib/supabase";

// All verified, active blood banks with their current stock per group.
// Read-only — hospitals browse this, they don't edit it.
export async function getBloodBankNetwork() {
  const { data, error } = await supabase
    .from("facilities")
    .select("id, facility_name, city, phone, latitude, longitude, blood_inventory(blood_group, units_available)")
    .eq("facility_type", "bloodbank")
    .eq("verification_status", "verified")
    .eq("is_active", true);

  if (error) throw new Error(error.message);
  return data;
}
