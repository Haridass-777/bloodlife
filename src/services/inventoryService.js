import { supabase } from "../lib/supabase";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// ============================================
// GET INVENTORY - All blood groups for facility
// ============================================
export async function getInventory(facilityId) {
  const { data, error } = await supabase
    .from("blood_inventory")
    .select("*")
    .eq("facility_id", facilityId)
    .order("blood_group");

  if (error) throw new Error(error.message);

  // Ensure all blood groups exist (even if 0 units)
  const existing = new Map((data || []).map((r) => [r.blood_group, r]));
  const complete = BLOOD_GROUPS.map((bg) =>
    existing.get(bg) || {
      id: null,
      facility_id: facilityId,
      blood_group: bg,
      units_available: 0,
      last_updated: new Date().toISOString(),
    }
  );

  return complete;
}

// ============================================
// SET INVENTORY - Set specific blood group units
// ============================================
export async function setInventory(facilityId, bloodGroup, unitsAvailable) {
  // Validate blood group
  if (!BLOOD_GROUPS.includes(bloodGroup)) {
    throw new Error(`Invalid blood group: ${bloodGroup}`);
  }

  // Ensure non-negative
  const units = Math.max(0, Number(unitsAvailable) || 0);

  const { data, error } = await supabase
    .from("blood_inventory")
    .upsert(
      {
        facility_id: facilityId,
        blood_group: bloodGroup,
        units_available: units,
        last_updated: new Date().toISOString(),
      },
      { onConflict: "facility_id,blood_group" }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// ADJUST INVENTORY - Add/subtract units
// ============================================
export async function adjustInventory(facilityId, bloodGroup, delta) {
  // Get current units
  const { data: current, error: fetchError } = await supabase
    .from("blood_inventory")
    .select("units_available")
    .eq("facility_id", facilityId)
    .eq("blood_group", bloodGroup)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);

  const currentUnits = current?.units_available || 0;
  const newUnits = Math.max(0, currentUnits + delta);

  return setInventory(facilityId, bloodGroup, newUnits);
}

// ============================================
// GET SINGLE BLOOD GROUP - Quick lookup
// ============================================
export async function getBloodGroupStock(facilityId, bloodGroup) {
  const { data, error } = await supabase
    .from("blood_inventory")
    .select("*")
    .eq("facility_id", facilityId)
    .eq("blood_group", bloodGroup)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || { facility_id: facilityId, blood_group: bloodGroup, units_available: 0 };
}

// ============================================
// BULK UPDATE INVENTORY - Set multiple at once
// ============================================
export async function bulkUpdateInventory(facilityId, updates) {
  const records = Object.entries(updates).map(([bg, units]) => ({
    facility_id: facilityId,
    blood_group: bg,
    units_available: Math.max(0, units),
    last_updated: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from("blood_inventory")
    .upsert(records, { onConflict: "facility_id,blood_group" })
    .select();

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// GET CRITICAL STOCK - Groups with low units
// ============================================
export async function getCriticalStock(facilityId, threshold = 2) {
  const inventory = await getInventory(facilityId);
  return inventory.filter((r) => r.units_available <= threshold);
}

// ============================================
// VALIDATE BLOOD GROUP
// ============================================
export function isValidBloodGroup(bg) {
  return BLOOD_GROUPS.includes(bg);
}

// ============================================
// GET ALL BLOOD GROUPS CONSTANT
// ============================================
export function getBloodGroups() {
  return [...BLOOD_GROUPS];
}