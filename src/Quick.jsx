import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { fetchEmergencyRequest, fetchMatches, notifyDonor } from "./services/searchService";
import "./Quick.css";

export default function QuickSearchPage() {
  const { requestId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  // Falls back to "attender" if this page is opened directly (e.g. refreshed).
  const role = location.state?.role || "attender";
  const isFacilityRole = role === "hospital" || role === "clinic" || role === "bloodbank";

  const [request, setRequest] = useState(null);
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sentIds, setSentIds] = useState([]);

  const load = useCallback(async () => {
    try {
      const [req, m] = await Promise.all([
        fetchEmergencyRequest(requestId),
        fetchMatches(requestId, role),
      ]);
      setRequest(req);
      setMatches(m);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [requestId, role]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 6000); // light polling since there's no websocket yet
    return () => clearInterval(interval);
  }, [load]);

  async function handleSendRequest(donorId) {
    try {
      await notifyDonor(requestId, donorId);
      setSentIds((s) => [...s, donorId]);
      load();
      // Actual WhatsApp/email/SMS delivery is handled outside this app.
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="qs-root">
      <header className="qs-header">
        <div className="wrap qs-header-inner">
          <a href="/" className="brand"><span className="dot"></span>BloodBridge</a>
          <span className="qs-req-id mono">{requestId}</span>
        </div>
      </header>

      <div className="wrap qs-content">
        {loading && <p className="qs-loading">Searching nearby hospitals, blood banks and donors…</p>}
        {error && <div className="qs-error">{error}</div>}

        {matches && request && (
          <>
            <div className="qs-summary-bar">
              <div>
                <h1>{matches.bloodGroup} needed nearby</h1>
                <p className="qs-sub">
                  {matches.radiusKm ? `Found within ${matches.radiusKm} km, nearest first.` : "Search radius expanded fully — showing everything found."}{" "}
                  {isFacilityRole
                    ? "Logged in as a verified facility — full contact details are shown below."
                    : "Hospital/blood bank contact stays with your care team; donor contact appears once a donor accepts."}
                </p>
              </div>
              <span className={`qs-priority-badge ${matches.priority.toLowerCase()}`}>{matches.priority} priority</span>
            </div>

            {matches.status === "completed" && (
              <div className="qs-resolved-banner">✓ This request has been marked resolved — a source has been confirmed.</div>
            )}

            <section className="qs-section">
              <h3>Hospitals &amp; blood banks <span className="qs-count">{matches.facilities.length}</span></h3>
              {matches.facilities.length === 0 && <p className="qs-empty-note">Nothing within range yet — the search radius will keep expanding automatically.</p>}
              <div className="qs-list">
                {matches.facilities.map((f) => (
                  <div className="qs-card" key={f.id}>
                    <div className="qs-distance-chip mono">{f.distanceKm != null ? `${f.distanceKm} km` : "—"}</div>
                    <div className="qs-card-main">
                      <div className="qs-card-title">{f.name} <span className="qs-type-tag">{f.type}</span></div>
                      <div className="qs-card-sub">{f.city} · {f.unitsAvailable} unit{f.unitsAvailable > 1 ? "s" : ""} in stock</div>
                      {f.phone ? (
                        <div className="qs-contact">📞 {f.phone}</div>
                      ) : (
                        <div className="qs-contact locked">🔒 Location only — pass this along to your hospital's care team</div>
                      )}
                    </div>
                    <span className={`qs-status-chip ${f.status}`}>{f.status}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="qs-section">
              <h3>Available donors <span className="qs-count">{matches.donors.length}</span></h3>
              {matches.donors.length === 0 && <p className="qs-empty-note">No matching donors within range right now.</p>}
              <div className="qs-list">
                {matches.donors.map((d) => {
                  const wasSent = d.notified || sentIds.includes(d.id);
                  return (
                    <div className="qs-card" key={d.id}>
                      <div className="qs-distance-chip mono">{d.distanceKm != null ? `${d.distanceKm} km` : "—"}</div>
                      <div className="qs-card-main">
                        <div className="qs-card-title">{d.name}</div>
                        <div className="qs-card-sub">
                          {d.city}
                          {d.accepted && <span className="qs-status-chip accepted" style={{ marginLeft: 8 }}>Accepted</span>}
                          {!d.accepted && wasSent && <span className="qs-status-chip pending" style={{ marginLeft: 8 }}>Alert sent — awaiting response</span>}
                        </div>
                        {d.phone ? (
                          <div className="qs-contact">📞 {d.phone}</div>
                        ) : (
                          <div className="qs-contact locked">🔒 Contact appears once this donor accepts</div>
                        )}
                      </div>
                      {!isFacilityRole && !d.accepted && !wasSent && (
                        <button className="btn btn-primary qs-send-btn" onClick={() => handleSendRequest(d.id)}>
                          Send request
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="qs-actions">
              <button className="btn btn-ghost" onClick={load}>↻ Refresh results</button>
              <button className="btn btn-ghost" onClick={() => navigate("/")}>Back to home</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
