import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getVerifiedFacilities } from "./services/facilityService";
import "./EmergencyRequestPage.css";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const REASONS = [
  { id: "accident", label: "Accident / trauma", priority: "Critical" },
  { id: "selfharm", label: "Suicide attempt / self-harm injury", priority: "Critical" },
  { id: "operation", label: "Surgery / operation", priority: "Scheduled" },
  { id: "other", label: "Other", priority: "Moderate" },
];

function priorityStyle(priority) {
  if (priority === "Critical") return "critical";
  if (priority === "Scheduled") return "scheduled";
  return "moderate";
}

export default function EmergencyRequestPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const facilityUser = location.state?.facilityUser || null; // set after hospital/clinic login
  const isFacilityMode = !!facilityUser;

  const [facilities, setFacilities] = useState([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(true);
  const [unknownFacility, setUnknownFacility] = useState(false);

  const [form, setForm] = useState({
    attenderName: "",
    attenderMobile: "",
    facilityId: "",
    unknownFacilityName: "",
    patientName: "",
    age: "",
    bloodGroup: "",
    unitsNeeded: 1,
    reason: "",
    details: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

// selection facilities
 useEffect(() => {
    if (isFacilityMode) return;

    async function loadFacilities() {
        try {
            const data = await getVerifiedFacilities();
            setFacilities(data);
        } catch (err) {
            console.error(err);
        } finally {
            setFacilitiesLoading(false);
        }
    }

    loadFacilities();
}, [isFacilityMode]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const selectedReason = REASONS.find((r) => r.id === form.reason);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.bloodGroup) return setError("Select a blood group.");
    if (!form.reason) return setError("Select a reason for the request.");
    if (!isFacilityMode) {
      if (!form.attenderName || !form.attenderMobile) return setError("Attender name and mobile number are required.");
      if (!unknownFacility && !form.facilityId) return setError("Select a hospital/clinic, or mark it as unknown.");
      if (unknownFacility && !form.unknownFacilityName) return setError("Enter the hospital/clinic name.");
    }

    const payload = isFacilityMode
      ? {
          source: facilityUser.role, // "hospital" | "clinic"
          facilityId: facilityUser.facilityId,
          patientName: form.patientName || "Unknown",
          age: form.age || "Unknown",
          bloodGroup: form.bloodGroup,
          unitsNeeded: Number(form.unitsNeeded) || 1,
          reason: form.reason,
          details: form.details,
        }
      : {
          source: "attender",
          attenderName: form.attenderName,
          attenderMobile: form.attenderMobile,
          facilityId: unknownFacility ? undefined : form.facilityId,
          unknownFacilityName: unknownFacility ? form.unknownFacilityName : undefined,
          patientName: form.patientName || "Unknown",
          age: form.age || "Unknown",
          bloodGroup: form.bloodGroup,
          unitsNeeded: Number(form.unitsNeeded) || 1,
          reason: form.reason,
          details: form.details,
        };

    setSubmitting(true);
    try {
      const data = await submitEmergencyRequest(payload);
      navigate("/quick-search", {
       state: {
       request: data,
       facilityUser,
        },
        });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="er-root">
        <div className="wrap er-content">
          <div className="er-card er-result">
            <div className={`er-priority-badge ${priorityStyle(result.priority)}`}>{result.priority} priority</div>
            <h2>Request submitted</h2>
            <p className="er-sub">
              Request ID <span className="mono">{result.id}</span> is now searching nearby stock and eligible donors.
            </p>
            <div className="er-summary">
              <div><span>Blood group</span><b>{result.bloodGroup}</b></div>
              <div><span>Units needed</span><b>{result.unitsNeeded}</b></div>
              <div><span>Facility</span><b>{result.facility?.name || "Not specified"}{!result.facilityVerified && result.facility ? " (unverified — pending confirmation)" : ""}</b></div>
              <div><span>Status</span><b className="mono">{result.status}</b></div>
            </div>
            <p className="er-note">🔔 Live matching, donor alerts and WhatsApp/email notifications will appear here — backend wiring for that comes next.</p>
            <button className="btn btn-ghost" onClick={() => navigate("/")}>Back to home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="er-root">
      <header className="er-header">
        <div className="wrap er-header-inner">
          <a href="/" className="brand"><span className="dot"></span>BloodBridge</a>
          <span className="er-mode-tag">{isFacilityMode ? `Logged in as ${facilityUser.name}` : "Guest emergency request"}</span>
        </div>
      </header>

      <div className="wrap er-content">
        <form className="er-card" onSubmit={handleSubmit}>
          <h1>Emergency blood request</h1>
          <p className="er-sub">
            {isFacilityMode
              ? "Submitting on behalf of your facility — details below go straight into the search."
              : "No login needed. Every request is linked to a verified facility so help always arrives somewhere real."}
          </p>

          {!isFacilityMode && (
            <div className="er-section">
              <h4>Your details</h4>
              <div className="er-grid-2">
                <label className="er-field">
                  <span>Attender name</span>
                  <input value={form.attenderName} onChange={(e) => update("attenderName", e.target.value)} required />
                </label>
                <label className="er-field">
                  <span>Attender mobile number</span>
                  <input value={form.attenderMobile} onChange={(e) => update("attenderMobile", e.target.value.replace(/\D/g, "").slice(0, 10))} required />
                </label>
              </div>
            </div>
          )}

          {!isFacilityMode && (
            <div className="er-section">
              <h4>Hospital / clinic</h4>
              {!unknownFacility ? (
                <>
                  <label className="er-field">
                    <span>Select a verified facility</span>
                    <select
                      value={form.facilityId}
                      onChange={(e) => update("facilityId", e.target.value)}
                      disabled={facilitiesLoading}
                    >
                      <option value="">{facilitiesLoading ? "Loading facilities…" : "Select hospital or clinic"}</option>
                      {facilities.map((f) => (
                        <option key={f.id} value={f.id}>{f.facility_name} ({f.facility_type}) - {f.city}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="er-link-btn" onClick={() => setUnknownFacility(true)}>
                    I don't know the exact name / it's not listed
                  </button>
                </>
              ) : (
                <>
                  <label className="er-field">
                    <span>Hospital / clinic name (as best you know it)</span>
                    <input value={form.unknownFacilityName} onChange={(e) => update("unknownFacilityName", e.target.value)} placeholder="e.g. the clinic near the bus stand" />
                  </label>
                  <span className="er-hint">This creates a temporary, unverified record — our team confirms it before matching donors.</span>
                  <button type="button" className="er-link-btn" onClick={() => setUnknownFacility(false)}>
                    Actually, let me pick from the list
                  </button>
                </>
              )}
            </div>
          )}

          <div className="er-section">
            <h4>Patient details</h4>
            <div className="er-grid-2">
              <label className="er-field">
                <span>Patient name</span>
                <input value={form.patientName} onChange={(e) => update("patientName", e.target.value)} placeholder="If known — otherwise leave as Unknown" />
                <span className="er-hint">If you don't know, leave blank — we'll record it as "Unknown."</span>
              </label>
              <label className="er-field">
                <span>Age</span>
                <input value={form.age} onChange={(e) => update("age", e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="Approximate is fine" />
                <span className="er-hint">If you don't know, give your best approximate guess.</span>
              </label>
            </div>
          </div>

          <div className="er-section">
            <h4>Blood needed</h4>
            <div className="er-pill-grid">
              {BLOOD_GROUPS.map((bg) => (
                <button type="button" key={bg} className={`er-pill ${form.bloodGroup === bg ? "selected" : ""}`} onClick={() => update("bloodGroup", bg)}>
                  {bg}
                </button>
              ))}
            </div>
            <label className="er-field" style={{ marginTop: 16, maxWidth: 180 }}>
              <span>Units needed</span>
              <input type="number" min={1} max={10} value={form.unitsNeeded} onChange={(e) => update("unitsNeeded", e.target.value)} />
            </label>
          </div>

          <div className="er-section">
            <h4>Reason for request</h4>
            <div className="er-reason-grid">
              {REASONS.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  className={`er-reason-card ${form.reason === r.id ? "selected" : ""}`}
                  onClick={() => update("reason", r.id)}
                >
                  <span>{r.label}</span>
                  <span className={`er-reason-priority ${priorityStyle(r.priority)}`}>{r.priority}</span>
                </button>
              ))}
            </div>
            {selectedReason && (
              <p className="er-hint" style={{ marginTop: 10 }}>
                This will be logged as <b>{selectedReason.priority} priority</b> based on the reason selected.
              </p>
            )}
          </div>

          <div className="er-section">
            <h4>Anything else? (optional)</h4>
            <textarea
              className="er-textarea"
              rows={4}
              value={form.details}
              onChange={(e) => update("details", e.target.value)}
              placeholder="Any other detail that could help — allergies, ongoing treatment, ward number, doctor's name, etc."
            />
          </div>

          {error && <div className="er-error">{error}</div>}

          <button type="submit" className="btn btn-primary er-submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit emergency request"}
          </button>
        </form>
      </div>
    </div>
  );
}
