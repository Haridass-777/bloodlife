import { supabase } from "../lib/supabase";

const RADIUS_STEPS_KM = [10, 25, 50, 100, 200];
const PRIORITY_DISPLAY = { critical: "Critical", medium: "Scheduled", low: "Moderate" };

// ============================================
// HAVERSINE DISTANCE CALCULATION
// ============================================
export function haversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;

  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// ============================================
// FETCH EMERGENCY REQUEST
// ============================================
export async function fetchEmergencyRequest(requestId) {
  const { data, error } = await supabase
    .from("emergency_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (error) throw new Error(`Request fetch failed: ${error.message}`);
  if (!data) throw new Error("Emergency request not found.");
  return data;
}

// ============================================
// FETCH MATCHES - Main search algorithm
// ============================================
export async function fetchMatches(requestId, role) {
  // Get request details
  const request = await fetchEmergencyRequest(requestId);
  const isFacilityViewer = role === "hospital" || role === "bloodbank";

  // ========== FACILITY MATCHES (Hospitals/Blood Banks with stock) ==========
  const { data: stock, error: stockError } = await supabase
    .from("blood_inventory")
    .select("units_available, facility_id, facilities(*)")
    .eq("blood_group", request.blood_group)
    .gt("units_available", 0);

  if (stockError) throw new Error(stockError.message);

  // Filter: only verified, active facilities
  const facilityMatches = (stock || [])
    .map((row) => row.facilities)
    .filter(
      (f) =>
        f &&
        f.is_active &&
        f.verification_status === "verified" &&
        f.id !== request.facility_id
    );

  // Add distance
  const withDistance = facilityMatches.map((f) => {
    const stock_units = (stock || []).find((s) => s.facility_id === f.id)?.units_available || 0;
    return {
      ...f,
      unitsAvailable: stock_units,
      distanceKm: haversineKm(request.latitude, request.longitude, f.latitude, f.longitude),
    };
  });

  // Determine search radius (expand until we find matches)
  let radiusKm = null;
  let inRangeFacilities = withDistance;

  if (request.latitude != null && request.longitude != null) {
    for (const r of RADIUS_STEPS_KM) {
      const within = withDistance.filter((f) => f.distanceKm != null && f.distanceKm <= r);
      if (within.length > 0) {
        radiusKm = r;
        inRangeFacilities = within;
        break;
      }
    }
  }

  // Sort by distance
  inRangeFacilities.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));

  // Get existing match records to check response status
  const { data: existingMatches, error: existingError } = await supabase
    .from("request_matches")
    .select("*")
    .eq("request_id", requestId);

  if (existingError) throw new Error(existingError.message);
  const existingByFacility = new Map((existingMatches || []).map((m) => [m.matched_id, m]));

  // ========== DONOR MATCHES (Available donors with correct blood group) ==========
  const { data: donors, error: donorError } = await supabase
    .from("donor_profiles")
    .select("*, user_accounts(full_name, mobile)")
    .eq("available", true)
    .eq("eligibility_level", "ok")
    .or(`blood_group.eq.${request.blood_group},blood_group.eq.O-`);

  if (donorError) throw new Error(donorError.message);

  const donorMatches = (donors || []).map((d) => ({
    ...d,
    distanceKm: haversineKm(request.latitude, request.longitude, d.latitude, d.longitude),
  }));

  // Determine donor search radius
  let inRangeDonors = donorMatches;
  if (request.latitude != null && request.longitude != null) {
    for (const r of RADIUS_STEPS_KM) {
      const within = donorMatches.filter((d) => d.distanceKm != null && d.distanceKm <= r);
      if (within.length > 0) {
        inRangeDonors = within;
        break;
      }
    }
  }

  inRangeDonors.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));

  // Get donor request status
  const { data: donorRequests, error: donorReqError } = await supabase
    .from("donor_requests")
    .select("*")
    .eq("request_id", requestId);

  if (donorReqError) throw new Error(donorReqError.message);
  const statusByDonor = new Map((donorRequests || []).map((r) => [r.donor_id, r]));

  return {
    bloodGroup: request.blood_group,
    priority: PRIORITY_DISPLAY[request.priority] || "Moderate",
    status: request.status,
    reason: request.reason,
    radiusKm,
    facilities: inRangeFacilities.map((f) => {
      const match = existingByFacility.get(f.id);
      return {
        id: f.id,
        name: f.facility_name,
        type: f.facility_type,
        city: f.city,
        distanceKm: f.distanceKm,
        unitsAvailable: f.unitsAvailable,
        status: match?.status || "pending",
        phone: isFacilityViewer ? f.phone : null,
      };
    }),
    donors: inRangeDonors.map((d) => {
      const existing = statusByDonor.get(d.id);
      const accepted = existing?.request_status === "accepted";
      return {
        id: d.id,
        name: d.user_accounts?.full_name || "Donor",
        city: d.city,
        distanceKm: d.distanceKm,
        accepted,
        notified: !!existing,
        responseStatus: existing?.request_status || null,
        // Contact details are revealed only after the donor accepts.
        phone: accepted ? d.user_accounts?.mobile : null,
        address: accepted
          ? [d.address, d.city, d.state, d.pincode].filter(Boolean).join(", ")
          : null,
      };
    }),
  };
}

// ============================================
// NOTIFY DONOR - Send request to donor
// ============================================
export async function notifyDonor(requestId, donorId) {
  // Check if already notified
  const { data: existing } = await supabase
    .from("donor_requests")
    .select("id")
    .eq("request_id", requestId)
    .eq("donor_id", donorId)
    .maybeSingle();

  if (existing) return existing;

  // Create new request
  const { data, error } = await supabase
    .from("donor_requests")
    .insert({
      request_id: requestId,
      donor_id: donorId,
      request_status: "sent",
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// GET DONOR RESPONSE - Check if donor accepted
// ============================================
export async function getDonorResponse(requestId, donorId) {
  const { data, error } = await supabase
    .from("donor_requests")
    .select("*")
    .eq("request_id", requestId)
    .eq("donor_id", donorId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// UPDATE DONOR RESPONSE
// ============================================
export async function updateDonorResponse(requestId, donorId, responseStatus) {
  const valid = ["sent", "accepted", "rejected", "visited", "completed"];
  if (!valid.includes(responseStatus)) throw new Error("Invalid response status.");

  const { data, error } = await supabase
    .from("donor_requests")
    .update({
      request_status: responseStatus,
      responded_at: responseStatus !== "sent" ? new Date().toISOString() : null,
    })
    .eq("request_id", requestId)
    .eq("donor_id", donorId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// DONOR INBOX - Requests that were sent to this donor
// ============================================
// Returns requests where an attender/facility pressed "Send request" on this
// donor and the donor has not answered yet. Each item is the emergency request
// plus `donorRequestId` (the donor_requests row).
export async function findRequestsForDonor(donorId, lat, lng) {
  const { data, error } = await supabase
    .from("donor_requests")
    .select("id, request_id, request_status, created_at, emergency_requests(*)")
    .eq("donor_id", donorId)
    .eq("request_status", "sent")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || [])
    .filter((row) => row.emergency_requests && row.emergency_requests.status === "searching")
    .map((row) => ({
      ...row.emergency_requests,
      donorRequestId: row.id,
      sentAt: row.created_at,
      distanceKm: haversineKm(lat, lng, row.emergency_requests.latitude, row.emergency_requests.longitude),
    }));
}

// ============================================
// GET REQUEST UPDATES - Real-time polling data
// ============================================
export async function getRequestUpdates(requestId) {
  const { data, error } = await supabase
    .from("emergency_requests")
    .select(
      `*,
       request_matches(id, matched_id, status, facilities(facility_name, city, phone)),
       donor_requests(id, donor_id, request_status, donor_profiles(user_accounts(full_name, mobile)))`
    )
    .eq("id", requestId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}