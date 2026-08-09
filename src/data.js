/* ---------------------------------------------------------
   DUMMY DATA STORE — everything here is in-memory only.
   Replace with a real database (MongoDB/Postgres/etc.) later.
--------------------------------------------------------- */

// Verified facilities — the ONLY hospitals/clinics selectable
// in the emergency request form and the facility login screen.
export const facilities = [
  { id: "HOSP-1001", name: "St. Mary Hospital", type: "hospital", city: "Coimbatore", verified: true, lat: 11.0041, lng: 76.9605 },
  { id: "HOSP-1002", name: "General City Hospital", type: "hospital", city: "Coimbatore", verified: true, lat: 11.0168, lng: 76.9558 },
  { id: "CLN-2001", name: "ABC Clinic", type: "clinic", city: "Coimbatore", verified: true, lat: 11.0025, lng: 76.9412 },
  { id: "CLN-2002", name: "Sunrise Family Clinic", type: "clinic", city: "Coimbatore", verified: true, lat: 10.9945, lng: 76.9612 },
  { id: "BB-3001", name: "City Blood Bank", type: "bloodbank", city: "Coimbatore", verified: true, lat: 11.0090, lng: 76.9520 },
];

// Dummy login credentials — plaintext ONLY because there is no
// real database yet. Never do this in production.
export const users = [
  { id: "HOSP-1001", password: "password123", role: "hospital", name: "St. Mary Hospital", facilityId: "HOSP-1001" },
  { id: "CLN-2001", password: "password123", role: "clinic", name: "ABC Clinic", facilityId: "CLN-2001" },
  { id: "BB-3001", password: "password123", role: "bloodbank", name: "City Blood Bank", facilityId: "BB-3001" },
  { id: "DNR-4001", password: "password123", role: "donor", name: "Arjun Kumar", bloodGroup: "O+" },
];

// Emergency requests get pushed in here as they're submitted.
export const emergencyRequests = [];

// Messages from the "verified facilities only — contact us" form.
export const contactMessages = [];

let requestCounter = 300;
export function nextRequestId() {
  requestCounter += 1;
  return `ER-${requestCounter}`;
}

let tempFacilityCounter = 900;
export function nextTempFacilityId() {
  tempFacilityCounter += 1;
  return `TEMP-${tempFacilityCounter}`;
}
