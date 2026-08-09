import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Hospital.css";
import { getInventory, setInventory, adjustInventory } from "./services/inventoryService";
import { createFacilityRequest, getFacilityRequests, updateRequestStatus } from "./services/emergencyRequestService";
import { getIncomingMatches, respondToMatch } from "./services/matchService";
import { getFacilityById, updateFacility } from "./services/facilityService";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const NAV_ITEMS = [
  { id: "inventory", label: "Blood Inventory" },
  { id: "requests", label: "Emergency Requests" },
  { id: "matches", label: "Incoming Matches" },
  { id: "profile", label: "Facility Profile" },
];

function VerifiedTag() {
  return (
    <span className="hp-verified">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M9 12l2 2 4-4" />
        <circle cx="12" cy="12" r="9" />
      </svg>
      VERIFIED
    </span>
  );
}

/* ---------------------------------------------------------
   Inventory
--------------------------------------------------------- */
function InventoryPanel({ facilityId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingGroup, setSavingGroup] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getInventory(facilityId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);

  function unitsFor(bg) {
    return rows.find((r) => r.blood_group === bg)?.units_available ?? 0;
  }

  async function handleAdjust(bg, delta) {
    setSavingGroup(bg);
    try {
      await adjustInventory(facilityId, bg, delta);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingGroup(null);
    }
  }

  async function handleSet(bg, value) {
    setSavingGroup(bg);
    try {
      await setInventory(facilityId, bg, Math.max(0, Number(value) || 0));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingGroup(null);
    }
  }

  return (
    <section>
      <h2>Blood Inventory</h2>
      <p className="hp-sub">Kept accurate here first — this is what every nearby search checks before it reaches a donor.</p>
      {error && <div className="hp-error">{error}</div>}
      {loading ? (
        <p className="hp-hint">Loading…</p>
      ) : (
        <div className="hp-inv-grid">
          {BLOOD_GROUPS.map((bg) => (
            <div className="hp-inv-card" key={bg}>
              <div className="hp-inv-bg mono">{bg}</div>
              <input
                type="number"
                min="0"
                className="hp-inv-input"
                value={unitsFor(bg)}
                onChange={(e) => handleSet(bg, e.target.value)}
                disabled={savingGroup === bg}
              />
              <div className="hp-inv-actions">
                <button className="btn btn-ghost" onClick={() => handleAdjust(bg, -1)} disabled={savingGroup === bg}>−1</button>
                <button className="btn btn-ghost" onClick={() => handleAdjust(bg, 1)} disabled={savingGroup === bg}>+1</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------
   Emergency requests (create + track own)
--------------------------------------------------------- */
function RequestsPanel({ facilityUser }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    patientName: "", age: "", gender: "", bloodGroup: "A+",
    unitsNeeded: 1, reason: "operation", details: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await getFacilityRequests(facilityUser.facility_id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [facilityUser.facility_id]);

  useEffect(() => { load(); }, [load]);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await createFacilityRequest(facilityUser, form);
      setForm({ patientName: "", age: "", gender: "", bloodGroup: "A+", unitsNeeded: 1, reason: "operation", details: "" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id) {
    try {
      await updateRequestStatus(id, "cancelled");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section>
      <h2>Emergency Requests</h2>
      <p className="hp-sub">Raise a request when your own stock comes up short, and track it here until it's resolved.</p>

      <form onSubmit={handleSubmit} className="hp-form">
        <div className="hp-grid-2">
          <label className="hp-field"><span>Patient name</span>
            <input value={form.patientName} onChange={(e) => update("patientName", e.target.value)} />
          </label>
          <label className="hp-field"><span>Age</span>
            <input type="number" min="0" value={form.age} onChange={(e) => update("age", e.target.value)} />
          </label>
          <label className="hp-field"><span>Gender</span>
            <select value={form.gender} onChange={(e) => update("gender", e.target.value)}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="hp-field"><span>Blood group</span>
            <select value={form.bloodGroup} onChange={(e) => update("bloodGroup", e.target.value)}>
              {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
            </select>
          </label>
          <label className="hp-field"><span>Units needed</span>
            <input type="number" min="1" value={form.unitsNeeded} onChange={(e) => update("unitsNeeded", Number(e.target.value))} />
          </label>
          <label className="hp-field"><span>Reason</span>
            <select value={form.reason} onChange={(e) => update("reason", e.target.value)}>
              <option value="accident">Accident</option>
              <option value="operation">Operation</option>
              <option value="selfharm">Critical</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
        <label className="hp-field"><span>Additional details (optional)</span>
          <textarea rows={3} value={form.details} onChange={(e) => update("details", e.target.value)} />
        </label>
        {error && <div className="hp-error">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Raise emergency request"}
        </button>
      </form>

      <h3 className="hp-subheading">Your requests</h3>
      {loading ? (
        <p className="hp-hint">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="hp-hint">No requests raised yet.</p>
      ) : (
        <div className="hp-req-list">
          {requests.map((r) => (
            <div className="hp-req-card" key={r.id}>
              <div className={`hp-urgency ${r.priority}`}>{r.priority}</div>
              <div className="hp-req-main">
                <div className="hp-req-title">{r.blood_group} · {r.units_required} unit{r.units_required > 1 ? "s" : ""}</div>
                <div className="hp-req-sub">{r.patient_name || "Unnamed patient"} · <span className="mono">{r.request_number}</span> · {r.status}</div>
              </div>
              {r.status === "searching" && (
                <button className="btn btn-ghost" onClick={() => handleCancel(r.id)}>Cancel</button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------
   Incoming matches (this facility as a possible source)
--------------------------------------------------------- */
function MatchesPanel({ facilityId, facilityType }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMatches(await getIncomingMatches(facilityId, facilityType));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [facilityId, facilityType]);

  useEffect(() => { load(); }, [load]);

  async function respond(matchId, status) {
    setActingId(matchId);
    try {
      await respondToMatch(matchId, status);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId(null);
    }
  }

  return (
    <section>
      <h2>Incoming Matches</h2>
      <p className="hp-sub">Other facilities' emergency requests where your stock was suggested as a possible source.</p>
      {error && <div className="hp-error">{error}</div>}
      {loading ? (
        <p className="hp-hint">Loading…</p>
      ) : matches.length === 0 ? (
        <p className="hp-hint">No incoming matches right now.</p>
      ) : (
        <div className="hp-req-list">
          {matches.map((m) => (
            <div className="hp-req-card" key={m.id}>
              <div className="hp-req-main">
                <div className="hp-req-title">
                  {m.emergency_requests?.blood_group} needed · {m.emergency_requests?.units_required} unit{(m.emergency_requests?.units_required ?? 1) > 1 ? "s" : ""}
                </div>
                <div className="hp-req-sub">
                  {m.distance_km != null ? `${m.distance_km} km away · ` : ""}<span className="mono">{m.emergency_requests?.request_number}</span> · {m.status}
                </div>
              </div>
              {m.status === "pending" && (
                <div className="hp-req-actions">
                  <button className="btn btn-primary" disabled={actingId === m.id} onClick={() => respond(m.id, "accepted")}>Accept</button>
                  <button className="btn btn-ghost" disabled={actingId === m.id} onClick={() => respond(m.id, "rejected")}>Decline</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------
   Facility profile
--------------------------------------------------------- */
function ProfilePanel({ facilityId }) {
  const [facility, setFacility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFacility(await getFacilityById(facilityId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);

  function update(key, value) {
    setFacility((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      setFacility(await updateFacility(facilityId, facility));
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="hp-hint">Loading…</p>;
  if (!facility) return <p className="hp-hint">Profile not found.</p>;

  return (
    <section>
      <div className="hp-panel-header">
        <h2>Facility Profile</h2>
        {facility.verification_status === "verified" && <VerifiedTag />}
      </div>

      <div className="hp-profile-grid">
        <div><span className="hp-field-label">Facility name</span><div>{facility.facility_name}</div></div>
        <div><span className="hp-field-label">Type</span><div className="mono">{facility.facility_type}</div></div>
        <div><span className="hp-field-label">City / District</span><div>{facility.city}, {facility.district}</div></div>

        <label className="hp-field"><span>Phone</span>
          <input value={facility.phone || ""} onChange={(e) => update("phone", e.target.value)} />
        </label>
        <label className="hp-field"><span>Emergency contact</span>
          <input value={facility.emergency_contact || ""} onChange={(e) => update("emergency_contact", e.target.value)} />
        </label>
        <label className="hp-field"><span>Address</span>
          <input value={facility.address || ""} onChange={(e) => update("address", e.target.value)} />
        </label>
        <label className="hp-field"><span>Total beds</span>
          <input type="number" min="0" value={facility.total_beds || ""} onChange={(e) => update("total_beds", Number(e.target.value))} />
        </label>
        <label className="hp-field hp-checkbox">
          <input type="checkbox" checked={!!facility.blood_bank_available} onChange={(e) => update("blood_bank_available", e.target.checked)} />
          <span>In-house blood bank</span>
        </label>
        <label className="hp-field hp-checkbox">
          <input type="checkbox" checked={!!facility.accepts_emergency_requests} onChange={(e) => update("accepts_emergency_requests", e.target.checked)} />
          <span>Accepting emergency requests</span>
        </label>
      </div>

      {error && <div className="hp-error">{error}</div>}
      <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
      </button>
    </section>
  );
}

/* ---------------------------------------------------------
   Page root
--------------------------------------------------------- */
export default function Hospital() {
  const location = useLocation();
  const navigate = useNavigate();
  const facilityUser = location.state?.facilityUser;
  const [active, setActive] = useState("inventory");

  useEffect(() => {
    if (!facilityUser) navigate("/login?role=hospital");
  }, [facilityUser, navigate]);

  if (!facilityUser) return null;

  return (
    <div className="hp-root">
      <header className="hp-header">
        <div className="wrap hp-header-inner">
          <a href="/" className="brand"><span className="dot"></span>BloodBridge</a>
          <span className="hp-header-tag">{facilityUser.full_name}</span>
        </div>
      </header>

      <div className="wrap hp-content">
        <div className="hp-dashboard">
          <aside className="hp-sidebar">
            <div className="hp-sidebar-profile">
              <div className="hp-avatar mono">{facilityUser.full_name?.[0] || "F"}</div>
              <div>
                <div className="hp-sidebar-name">{facilityUser.full_name}</div>
                <div className="hp-sidebar-sub mono">{facilityUser.user_code}</div>
              </div>
            </div>
            <nav className="hp-nav">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  className={`hp-nav-item ${active === item.id ? "active" : ""}`}
                  onClick={() => setActive(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          <main className="hp-panel">
            {active === "inventory" && <InventoryPanel facilityId={facilityUser.facility_id} />}
            {active === "requests" && <RequestsPanel facilityUser={facilityUser} />}
            {active === "matches" && <MatchesPanel facilityId={facilityUser.facility_id} facilityType={facilityUser.role} />}
            {active === "profile" && <ProfilePanel facilityId={facilityUser.facility_id} />}
          </main>
        </div>
      </div>
    </div>
  );
}
