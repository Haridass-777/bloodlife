import express from "express";
import { facilities, emergencyRequests, nextRequestId, nextTempFacilityId } from "../data.js";

const router = express.Router();

// Reason -> priority mapping. Tweak freely as real triage
// rules get defined later.
function priorityForReason(reason) {
  if (reason === "accident") return "Critical";
  if (reason === "selfharm") return "Critical";
  if (reason === "operation") return "Scheduled";
  return "Moderate"; // "other"
}

// POST /api/emergency-request
// Two shapes of payload depending on who is submitting:
//
// Attender (guest, no login):
// { source: "attender", attenderName, attenderMobile,
//   facilityId?, unknownFacilityName?, patientName, age, bloodGroup,
//   unitsNeeded, reason, details }
//
// Hospital/Clinic staff (logged in):
// { source: "hospital" | "clinic", facilityId, patientName, age,
//   bloodGroup, unitsNeeded, reason, details }
router.post("/", (req, res) => {
  const body = req.body || {};
  const { source, patientName, age, bloodGroup, unitsNeeded, reason } = body;

  if (!["attender", "hospital", "clinic"].includes(source)) {
    return res.status(400).json({ error: "Invalid request source." });
  }
  if (!bloodGroup) {
    return res.status(400).json({ error: "Blood group is required." });
  }
  if (!reason) {
    return res.status(400).json({ error: "Reason for the request is required." });
  }

  let facilityRecord = null;
  let facilityVerified = false;

  if (source === "attender") {
    if (!body.attenderName || !body.attenderMobile) {
      return res.status(400).json({ error: "Attender name and mobile number are required." });
    }
    if (body.facilityId) {
      facilityRecord = facilities.find((f) => f.id === body.facilityId) || null;
      facilityVerified = !!facilityRecord;
    } else if (body.unknownFacilityName) {
      // Facility not in our verified list — create a temporary,
      // UNVERIFIED record so staff can confirm it later.
      facilityRecord = {
        id: nextTempFacilityId(),
        name: body.unknownFacilityName,
        type: "unknown",
        verified: false,
      };
      facilityVerified = false;
    } else {
      return res.status(400).json({ error: "Select a hospital/clinic, or mark it as unknown." });
    }
  } else {
    // hospital or clinic staff — must already be logged in and
    // pass their own facilityId, no manual entry allowed.
    facilityRecord = facilities.find((f) => f.id === body.facilityId) || null;
    if (!facilityRecord) {
      return res.status(401).json({ error: "Facility session not recognized — please log in again." });
    }
    facilityVerified = true;
  }

  const record = {
    id: nextRequestId(),
    source, // "attender" | "hospital" | "clinic"
    createdAt: new Date().toISOString(),
    patientName: patientName || "Unknown",
    age: age || "Unknown",
    bloodGroup,
    unitsNeeded: unitsNeeded || 1,
    reason,
    priority: priorityForReason(reason),
    details: body.details || "",
    facility: facilityRecord,
    facilityVerified,
    attender: source === "attender" ? { name: body.attenderName, mobile: body.attenderMobile } : null,
    status: "searching", // searching -> matched -> resolved
  };

  emergencyRequests.push(record);
  res.status(201).json(record);
});

// GET /api/emergency-request  (list all — used by dashboards later)
router.get("/", (req, res) => {
  res.json(emergencyRequests);
});

export default router;
