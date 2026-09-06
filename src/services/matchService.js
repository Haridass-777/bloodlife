import { supabase } from "../lib/supabase";

// ============================================
// GET INCOMING MATCHES - For facility dashboard
// ============================================
export async function getIncomingMatches(facilityId, facilityType, statusFilter = null) {
  let query = supabase
    .from("request_matches")
    .select("*, emergency_requests(*)")
    .eq("match_type", facilityType)
    .eq("matched_id", facilityId);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// GET PENDING MATCHES - Count for badge
// ============================================
export async function getPendingMatchesCount(facilityId, facilityType) {
  const { data, error, count } = await supabase
    .from("request_matches")
    .select("id", { count: "exact", head: true })
    .eq("match_type", facilityType)
    .eq("matched_id", facilityId)
    .eq("status", "pending");

  if (error) throw new Error(error.message);
  return count || 0;
}

// ============================================
// RESPOND TO MATCH - Accept or reject
// ============================================
export async function respondToMatch(matchId, status) {
  // Valid statuses
  if (!["accepted", "rejected", "pending"].includes(status)) {
    throw new Error("Invalid match status.");
  }

  const updatePayload = {
    status,
    responded_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("request_matches")
    .update(updatePayload)
    .eq("id", matchId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// CREATE MANUAL MATCH - Admin/staff function
// ============================================
export async function createManualMatch(requestId, facilityId, facilityType) {
  const { data, error } = await supabase
    .from("request_matches")
    .insert({
      request_id: requestId,
      matched_id: facilityId,
      match_type: facilityType,
      status: "pending",
      distance_km: null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// GET MATCH DETAILS - Full match record
// ============================================
export async function getMatchById(matchId) {
  const { data, error } = await supabase
    .from("request_matches")
    .select("*, emergency_requests(*), facilities(*)")
    .eq("id", matchId)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Match not found.");
  return data;
}

// ============================================
// DELETE MATCH - Remove if no longer needed
// ============================================
export async function deleteMatch(matchId) {
  const { error } = await supabase
    .from("request_matches")
    .delete()
    .eq("id", matchId);

  if (error) throw new Error(error.message);
}

// ============================================
// GET MATCHES FOR REQUEST - All facilities offering
// ============================================
export async function getMatchesForRequest(requestId) {
  const { data, error } = await supabase
    .from("request_matches")
    .select("*, facilities(id, facility_name, city, phone)")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// ACCEPT MATCH AND UPDATE INVENTORY
// ============================================
export async function acceptMatchAndReduce(matchId, unitsUsed) {
  // 1. Update match status
  const { data: match, error: matchError } = await supabase
    .from("request_matches")
    .update({ status: "accepted" })
    .eq("id", matchId)
    .select()
    .single();

  if (matchError) throw new Error(matchError.message);

  // 2. Reduce inventory at source facility
  if (match.matched_id && unitsUsed > 0) {
    const request = await supabase
      .from("emergency_requests")
      .select("blood_group")
      .eq("id", match.request_id)
      .single();

    if (!request.error && request.data) {
      const bloodGroup = request.data.blood_group;
      
      // Get current inventory
      const { data: inv } = await supabase
        .from("blood_inventory")
        .select("units_available")
        .eq("facility_id", match.matched_id)
        .eq("blood_group", bloodGroup)
        .single();

      const currentUnits = inv?.units_available || 0;
      const newUnits = Math.max(0, currentUnits - unitsUsed);

      // Update inventory
      await supabase
        .from("blood_inventory")
        .update({
          units_available: newUnits,
          last_updated: new Date().toISOString(),
        })
        .eq("facility_id", match.matched_id)
        .eq("blood_group", bloodGroup);
    }
  }

  return match;
}