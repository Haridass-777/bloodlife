import { supabase } from "../lib/supabase";

function priorityForReason(reason) {
  if (reason === "accident" || reason === "selfharm") return "critical";
  if (reason === "operation") return "medium";
  return "low";
}

function makeRequestNumber() {
  return `ER-${Date.now().toString().slice(-6)}`;
}

// Hospital/clinic staff raise a request tied to their own facility.
// `facilityUser` is the object returned by authService.login().
export async function createFacilityRequest(facilityUser, payload) {
  const record = {
    request_number: makeRequestNumber(),
    facility_id: facilityUser.facility_id,
    created_by: facilityUser.id,
    requester_type: facilityUser.role, // 'hospital' | 'clinic'
    requester_name: facilityUser.full_name,
    requester_phone: facilityUser.mobile,
    patient_name: payload.patientName || null,
    patient_age: payload.age || null,
    patient_gender: payload.gender || null,
    blood_group: payload.bloodGroup,
    units_required: payload.unitsNeeded,
    reason: payload.reason,
    priority: priorityForReason(payload.reason),
    status: "searching",
    notes: payload.details || null,
  };

  const { data, error } = await supabase
    .from("emergency_requests")
    .insert(record)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// All requests this facility has raised, newest first.
export async function getFacilityRequests(facilityId) {
  const { data, error } = await supabase
    .from("emergency_requests")
    .select("*")
    .eq("facility_id", facilityId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// searching -> matched -> completed / cancelled
export async function updateRequestStatus(requestId, status) {
  const { data, error } = await supabase
    .from("emergency_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
