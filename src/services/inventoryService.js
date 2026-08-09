import { supabase } from "../lib/supabase";

// All units for a facility, one row per blood group.
export async function getInventory(facilityId) {
  const { data, error } = await supabase
    .from("blood_inventory")
    .select("id, blood_group, units_available, last_updated")
    .eq("facility_id", facilityId)
    .order("blood_group");

  if (error) throw error;
  return data;
}

// Set an exact unit count for a blood group (creates the row if it
// doesn't exist yet, thanks to the UNIQUE(facility_id, blood_group)
// constraint + upsert).
export async function setInventory(facilityId, bloodGroup, unitsAvailable) {
  const { data, error } = await supabase
    .from("blood_inventory")
    .upsert(
      {
        facility_id: facilityId,
        blood_group: bloodGroup,
        units_available: Math.max(0, unitsAvailable),
        last_updated: new Date().toISOString(),
      },
      { onConflict: "facility_id,blood_group" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Convenience wrapper for "+1 unit in" / "-1 unit out" style buttons.
export async function adjustInventory(facilityId, bloodGroup, delta) {
  const rows = await getInventory(facilityId);
  const current = rows.find((r) => r.blood_group === bloodGroup)?.units_available || 0;
  return setInventory(facilityId, bloodGroup, current + delta);
}
