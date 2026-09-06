import { supabase } from "../lib/supabase";

// ============================================
// HELPER: Priority from reason
// ============================================
function priorityForReason(reason) {
  const priorities = {
    accident: "critical",
    selfharm: "critical",
    trauma: "critical",
    operation: "medium",
    delivery: "medium",
    other: "low",
  };
  return priorities[reason] || "low";
}

// ============================================
// HELPER: Generate request number
// ============================================
function makeRequestNumber() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000);
  return `ER-${timestamp}-${random}`;
}

// ============================================
// SUBMIT EMERGENCY REQUEST - From attender
// ============================================
export async function submitEmergencyRequest(payload) {
  // Validate required fields
  if (!payload.bloodGroup) throw new Error("Blood group is required.");
  if (!payload.reason) throw new Error("Reason for request is required.");
  if (!payload.requesterName) throw new Error("Requester name is required.");
  if (!payload.requesterPhone) throw new Error("Requester phone is required.");

  const record = {
    request_number: makeRequestNumber(),
    facility_id: payload.facilityId || null,
    created_by: payload.createdBy || null,
    requester_type: payload.source || "attender", // attender, hospital, bloodbank
    requester_name: payload.requesterName,
    requester_phone: payload.requesterPhone,
    requester_email: payload.requesterEmail || null,
    patient_name: payload.patientName || "Unknown",
    patient_age: payload.age || null,
    patient_gender: payload.gender || null,
    blood_group: payload.bloodGroup,
    units_required: payload.unitsNeeded || 1,
    reason: payload.reason,
    priority: priorityForReason(payload.reason),
    hospital_name: payload.hospitalName || null,
    hospital_location: payload.hospitalLocation || null,
    latitude: payload.latitude || null,
    longitude: payload.longitude || null,
    status: "searching", // searching, pending, completed, cancelled
    notes: payload.details || null,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("emergency_requests")
    .insert(record)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// CREATE FACILITY REQUEST - From hospital/bloodbank
// ============================================
export async function createFacilityRequest(facilityUser, payload) {
  // Validate
  if (!payload.bloodGroup) throw new Error("Blood group is required.");
  if (!payload.reason) throw new Error("Reason is required.");

  const record = {
    request_number: makeRequestNumber(),
    facility_id: facilityUser.facility_id,
    created_by: facilityUser.id,
    requester_type: facilityUser.role, // hospital or bloodbank
    requester_name: facilityUser.full_name,
    requester_phone: facilityUser.mobile,
    requester_email: facilityUser.email || null,
    patient_name: payload.patientName || "Unknown",
    patient_age: payload.age || null,
    patient_gender: payload.gender || null,
    blood_group: payload.bloodGroup,
    units_required: payload.unitsNeeded || 1,
    reason: payload.reason,
    priority: priorityForReason(payload.reason),
    status: "searching",
    notes: payload.details || null,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("emergency_requests")
    .insert(record)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Create match records for nearby facilities (auto-match)
  await autoMatchFacilities(data.id, facilityUser.facility_id, payload.bloodGroup);

  return data;
}

// ============================================
// AUTO-MATCH FACILITIES - Find nearby with stock
// ============================================
async function autoMatchFacilities(requestId, excludeFacilityId, bloodGroup) {
  // Get inventory records with facility details
  const { data: stock, error } = await supabase
    .from("blood_inventory")
    .select("facility_id, units_available, facilities(id, facility_type, verification_status, is_active)")
    .eq("blood_group", bloodGroup)
    .gt("units_available", 0);

  if (error) return; // Silent fail on auto-match

  // Get request details for distance calc
  const { data: request } = await supabase
    .from("emergency_requests")
    .select("latitude, longitude")
    .eq("id", requestId)
    .single();

  const matches = [];
  for (const row of stock || []) {
    const f = row.facilities;
    if (!f || f.id === excludeFacilityId || !f.is_active || f.verification_status !== "verified") continue;

    const distance = calculateDistance(request?.latitude, request?.longitude, null, null);

    matches.push({
      request_id: requestId,
      matched_id: f.id,
      match_type: f.facility_type,
      units_available: row.units_available,
      distance_km: distance,
      status: "pending",
    });
  }

  if (matches.length > 0) {
    await supabase.from("request_matches").insert(matches);
  }
}

// ============================================
// GET FACILITY REQUESTS - All requests from facility
// ============================================
export async function getFacilityRequests(facilityId, statusFilter = null) {
  let query = supabase
    .from("emergency_requests")
    .select("*")
    .eq("facility_id", facilityId);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// GET EMERGENCY REQUEST BY ID
// ============================================
export async function getEmergencyRequestById(requestId) {
  const { data, error } = await supabase
    .from("emergency_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Request not found.");
  return data;
}

// ============================================
// UPDATE REQUEST STATUS
// ============================================
export async function updateRequestStatus(requestId, status) {
  // Valid statuses
  const validStatuses = ["searching", "pending", "completed", "cancelled", "paused"];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const { data, error } = await supabase
    .from("emergency_requests")
    .update({ 
      status,
      updated_at: new Date().toISOString()
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// GET REQUESTS BY STATUS - For dashboard views
// ============================================
export async function getRequestsByStatus(status) {
  const { data, error } = await supabase
    .from("emergency_requests")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// SEARCH REQUESTS - By location/blood group
// ============================================
export async function searchRequests(bloodGroup, lat = null, lng = null, radiusKm = 100) {
  let query = supabase
    .from("emergency_requests")
    .select("*")
    .eq("blood_group", bloodGroup)
    .eq("status", "searching");

  const { data, error } = await query.order("priority", { ascending: false });

  if (error) throw new Error(error.message);

  // Filter by distance if coordinates provided
  if (lat && lng) {
    return (data || [])
      .map((r) => ({
        ...r,
        distanceKm: calculateDistance(lat, lng, r.latitude, r.longitude),
      }))
      .filter((r) => r.distanceKm && r.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  return data || [];
}

// ============================================
// MARK REQUEST COMPLETE
// ============================================
export async function completeRequest(requestId) {
  const { data, error } = await supabase
    .from("emergency_requests")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// HELPER: Calculate distance
// ============================================
function calculateDistance(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;

  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}