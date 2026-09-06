import { supabase } from "../lib/supabase";

// ============================================
// GET VERIFIED FACILITIES - For search/listing
// ============================================
export async function getVerifiedFacilities(type = null, city = null) {
  let query = supabase
    .from("facilities")
    .select("id, facility_name, city, district, facility_type, latitude, longitude, phone, is_active, verification_status")
    .eq("verification_status", "verified")
    .eq("is_active", true);

  if (type) {
    query = query.eq("facility_type", type);
  }

  if (city) {
    query = query.eq("city", city);
  }

  const { data, error } = await query.order("facility_name");
  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// GET FACILITY BY ID - Full profile
// ============================================
export async function getFacilityById(facilityId) {
  const { data, error } = await supabase
    .from("facilities")
    .select("*")
    .eq("id", facilityId)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Facility not found.");
  return data;
}

// ============================================
// UPDATE FACILITY - Edit allowed fields only
// ============================================
export async function updateFacility(facilityId, updates) {
  // Only allow changes to these fields
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
    if (key in updates) {
      payload[key] = updates[key];
    }
  }
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("facilities")
    .update(payload)
    .eq("id", facilityId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// GET BLOOD BANK DIRECTORY - Read-only stock
// ============================================
export async function getBloodBankDirectory(excludeFacilityId) {
  // Fetch all blood inventory with facility details
  const { data, error } = await supabase
    .from("blood_inventory")
    .select("blood_group, units_available, facility_id, facilities(id, facility_name, city, district, phone, latitude, longitude, facility_type, verification_status, is_active)")
    .gt("units_available", 0);

  if (error) throw new Error(error.message);

  // Group by facility
  const byFacility = new Map();
  for (const row of data || []) {
    const f = row.facilities;
    
    // Filter: only verified, active blood banks
    if (!f || f.facility_type !== "bloodbank" || f.verification_status !== "verified" || !f.is_active) {
      continue;
    }
    
    // Don't show own facility
    if (f.id === excludeFacilityId) {
      continue;
    }

    // Initialize facility entry
    if (!byFacility.has(f.id)) {
      byFacility.set(f.id, {
        id: f.id,
        name: f.facility_name,
        city: f.city,
        district: f.district,
        phone: f.phone,
        latitude: f.latitude,
        longitude: f.longitude,
        stock: [],
      });
    }

    // Add blood group stock
    byFacility.get(f.id).stock.push({
      bloodGroup: row.blood_group,
      units: row.units_available,
    });
  }

  return Array.from(byFacility.values());
}

// ============================================
// SEARCH NEARBY FACILITIES - By distance
// ============================================
export async function getNearbyCities(lat, lng, radiusKm = 50) {
  if (lat == null || lng == null) return [];

  const { data, error } = await supabase
    .from("facilities")
    .select("id, city, district, latitude, longitude, facility_name, facility_type")
    .eq("is_active", true)
    .eq("verification_status", "verified");

  if (error) throw new Error(error.message);

  // Calculate distance and filter
  const nearby = (data || [])
    .map((f) => {
      const d = haversineDistance(lat, lng, f.latitude, f.longitude);
      return { ...f, distanceKm: d };
    })
    .filter((f) => f.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return nearby;
}

// ============================================
// HAVERSINE DISTANCE CALCULATION
// ============================================
function haversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // Round to 1 decimal place
}

// ============================================
// CHECK FACILITY ACTIVE STATUS
// ============================================
export async function checkFacilityStatus(facilityId) {
  const { data, error } = await supabase
    .from("facilities")
    .select("is_active, verification_status, account_status")
    .eq("id", facilityId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}