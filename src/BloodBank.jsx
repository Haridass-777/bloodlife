import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Hospital.css";
import { OverviewPanel, InventoryPanel, MatchesPanel, ProfilePanel } from "./FacilityPanels";

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "inventory", label: "Blood Inventory" },
  { id: "matches", label: "Incoming Requests" },
  { id: "profile", label: "Facility Profile" },
];

export default function BloodBank() {
  const location = useLocation();
  const navigate = useNavigate();
  const facilityUser = location.state?.facilityUser;
  const [active, setActive] = useState("overview");

  useEffect(() => {
    if (!facilityUser) navigate("/login?role=bloodbank");
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
              <div className="hp-avatar mono">{facilityUser.full_name?.[0] || "B"}</div>
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
            {active === "overview" && <OverviewPanel facilityId={facilityUser.facility_id} facilityType="bloodbank" />}
            {active === "inventory" && <InventoryPanel facilityId={facilityUser.facility_id} />}
            {active === "matches" && <MatchesPanel facilityId={facilityUser.facility_id} facilityType="bloodbank" />}
            {active === "profile" && <ProfilePanel facilityId={facilityUser.facility_id} />}
          </main>
        </div>
      </div>
    </div>
  );
}
