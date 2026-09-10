import { useState, useEffect, useCallback } from "react";
import { getInventory, setInventory, adjustInventory } from "./services/inventoryService";
import { getIncomingMatches, respondToMatch } from "./services/matchService";
import { getFacilityById, updateFacility } from "./services/facilityService";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const LOW_STOCK_THRESHOLD = 3;

export function VerifiedTag() {
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
   Overview — quick-glance stats, shown to both hospital and
   blood bank dashboards.
--------------------------------------------------------- */
export function OverviewPanel({ facilityId, facilityType }) {
  const [rows, setRows] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, m] = await Promise.all([
        getInventory(facilityId),
        getIncomingMatches(facilityId, facilityType),
      ]);
      setRows(inv);
      setMatches(m);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [facilityId, facilityType]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="hp-hint">Loading overview…</p>;

  const totalUnits = rows.reduce((sum, r) => sum + (r.units_available || 0), 0);
  const stockedGroups = rows.filter((r) => (r.units_available || 0) > 0);
  const lowStock = stockedGroups.filter((r) => r.units_available < LOW_STOCK_THRESHOLD);
  const pendingMatches = matches.filter((m) => m.status === "pending");

  return (
    <section>
      <h2>Overview</h2>
      <p className="hp-sub">A quick snapshot before you dig into a specific tab.</p>
      {error && <div className="hp-error">{error}</div>}

      <div className="hp-inv-grid" style={{ marginTop: 22 }}>
        <div className="hp-inv-card">
          <div className="hp-inv-bg mono">{totalUnits}</div>
          <div className="hp-hint" style={{ marginTop: 6 }}>Total units in stock</div>
        </div>
        <div className="hp-inv-card">
          <div className="hp-inv-bg mono">{pendingMatches.length}</div>
          <div className="hp-hint" style={{ marginTop: 6 }}>Pending incoming requests</div>
        </div>
        <div className="hp-inv-card">
          <div className="hp-inv-bg mono">{lowStock.length}</div>
          <div className="hp-hint" style={{ marginTop: 6 }}>Blood groups running low</div>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="hp-error" style={{ marginTop: 22 }}>
          Running low (under {LOW_STOCK_THRESHOLD} units): {lowStock.map((r) => r.blood_group).join(", ")}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------
   Inventory
--------------------------------------------------------- */
export function InventoryPanel({ facilityId }) {
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
   Incoming matches (this facility as a possible source)
--------------------------------------------------------- */
export function MatchesPanel({ facilityId, facilityType }) {
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
      <h2>Incoming Requests</h2>
      <p className="hp-sub">Emergency requests elsewhere where your stock was suggested as a possible source.</p>
      {error && <div className="hp-error">{error}</div>}
      {loading ? (
        <p className="hp-hint">Loading…</p>
      ) : matches.length === 0 ? (
        <p className="hp-hint">No incoming matches right now.</p>
      ) : (
        <div className="hp-req-list">
          {matches.map((m) => (
            <div className="hp-req-card" key={m.id}>
              <div className={`hp-urgency ${m.emergency_requests?.priority}`}>{m.emergency_requests?.priority}</div>
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
export function ProfilePanel({ facilityId }) {
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
        {facility.facility_type === "hospital" && (
          <label className="hp-field"><span>Total beds</span>
            <input type="number" min="0" value={facility.total_beds || ""} onChange={(e) => update("total_beds", Number(e.target.value))} />
          </label>
        )}
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
