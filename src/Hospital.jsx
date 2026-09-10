import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Hospital.css";
import { OverviewPanel, InventoryPanel, MatchesPanel, ProfilePanel } from "./FacilityPanels";
import { createFacilityRequest, getFacilityRequests, updateRequestStatus } from "./services/emergencyRequestService";
import { getBloodBankNetwork } from "./services/bloodBankService";
import { getFacilityById } from "./services/facilityService";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "inventory", label: "Blood Inventory" },
  { id: "requests", label: "Emergency Requests" },
  { id: "matches", label: "Incoming Requests" },
  { id: "bloodbank", label: "Blood Bank Network" },
  { id: "profile", label: "Facility Profile" },
];

function haversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/* ---------------------------------------------------------
   Emergency requests (create + track own) — hospital-only,
   a blood bank doesn't raise patient-facing requests.
--------------------------------------------------------- */
function RequestsPanel({ facilityUser }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    patientName: "", age: "", bloodGroup: "A+",
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
      setForm({ patientName: "", age: "", bloodGroup: "A+", unitsNeeded: 1, reason: "operation", details: "" });
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
   Blood Bank Network — read-only browse of nearby blood
   banks' live stock. Blood banks manage their own inventory
   through their own separate account — this panel never
   writes anything.
--------------------------------------------------------- */
function BloodBankNetworkPanel({ facilityId }) {
  const navigate = useNavigate();
  const [banks, setBanks] = useState([]);
  const [ownLocation, setOwnLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [network, own] = await Promise.all([
          getBloodBankNetwork(),
          getFacilityById(facilityId),
        ]);
        setBanks(network);
        setOwnLocation(own);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [facilityId]);

  const withDistance = banks
    .map((b) => {
      const stock = (b.blood_inventory || []).filter((s) => s.units_available > 0);
      const totalUnits = stock.reduce((sum, s) => sum + s.units_available, 0);
      return {
        ...b,
        stock,
        totalUnits,
        distanceKm: ownLocation
          ? haversineKm(ownLocation.latitude, ownLocation.longitude, b.latitude, b.longitude)
          : null,
      };
    })
    .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));

  return (
    <section>
      <div className="hp-panel-header">
        <h2>Blood Bank Network</h2>
      </div>
      <p className="hp-sub">
        Live stock from partner blood banks — browse only, they manage their own inventory.
      </p>

      <div
        className="hp-req-card"
        style={{ marginTop: 20, background: "rgba(225,58,46,0.06)", borderColor: "rgba(225,58,46,0.25)" }}
      >
        <div className="hp-req-main">
          <div className="hp-req-title">Are you blood bank staff?</div>
          <div className="hp-req-sub">Log in with your own blood bank account to manage stock and respond to requests.</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/login?role=bloodbank")}>
          Blood bank login →
        </button>
      </div>

      {error && <div className="hp-error" style={{ marginTop: 20 }}>{error}</div>}
      {loading ? (
        <p className="hp-hint">Loading network…</p>
      ) : withDistance.length === 0 ? (
        <p className="hp-hint" style={{ marginTop: 20 }}>No verified blood banks in the network yet.</p>
      ) : (
        <div className="hp-req-list" style={{ marginTop: 20 }}>
          {withDistance.map((b) => (
            <div className="hp-req-card" key={b.id}>
              <div className="mono" style={{ minWidth: 70 }}>
                {b.distanceKm != null ? `${b.distanceKm} km` : "—"}
              </div>
              <div className="hp-req-main">
                <div className="hp-req-title">{b.facility_name}</div>
                <div className="hp-req-sub">
                  {b.city} · {b.totalUnits} unit{b.totalUnits === 1 ? "" : "s"} in stock
                  {b.stock.length > 0 && (
                    <> — {b.stock.map((s) => `${s.blood_group} (${s.units_available})`).join(", ")}</>
                  )}
                </div>
              </div>
              {b.phone && <div className="mono hp-hint">📞 {b.phone}</div>}
            </div>
          ))}
        </div>
      )}
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
  const [active, setActive] = useState("overview");

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
              <div className="hp-avatar mono">{facilityUser.full_name?.[0] || "H"}</div>
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
            {active === "overview" && <OverviewPanel facilityId={facilityUser.facility_id} facilityType="hospital" />}
            {active === "inventory" && <InventoryPanel facilityId={facilityUser.facility_id} />}
            {active === "requests" && <RequestsPanel facilityUser={facilityUser} />}
            {active === "matches" && <MatchesPanel facilityId={facilityUser.facility_id} facilityType="hospital" />}
            {active === "bloodbank" && <BloodBankNetworkPanel facilityId={facilityUser.facility_id} />}
            {active === "profile" && <ProfilePanel facilityId={facilityUser.facility_id} />}
          </main>
        </div>
      </div>
    </div>
  );
}
