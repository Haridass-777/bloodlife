import { supabase } from "../lib/supabase";

// Requests where THIS facility has been suggested as a possible
// source of blood (match_type + matched_id identify the facility,
// per request_matches's design). Pulls the parent request inline
// via Supabase's foreign-table select syntax.
export async function getIncomingMatches(facilityId, facilityType) {
  const { data, error } = await supabase
    .from("request_matches")
    .select("*, emergency_requests(*)")
    .eq("match_type", facilityType) // 'hospital' | 'clinic' | 'bloodbank'
    .eq("matched_id", facilityId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// status: 'accepted' | 'rejected'
export async function respondToMatch(matchId, status) {
  const { data, error } = await supabase
    .from("request_matches")
    .update({ status })
    .eq("id", matchId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
