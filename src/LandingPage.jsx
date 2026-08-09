import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";

const ROLES = [
  {
    id: "01",
    title: "Super Admin",
    desc: "Verifies every hospital, clinic, blood bank and volunteer before they can appear in a search result.",
    chips: ["Verification", "Analytics", "Fraud control"],
  },
  {
    id: "02",
    title: "Hospital Blood Coordinator",
    desc: "Creates and tracks emergency requests alongside the hospital's existing HMS.",
    chips: ["Reserve blood", "Contact donors", "Track status"],
  },
  {
    id: "03",
    title: "Blood Bank Manager",
    desc: "Owns live inventory — the number every other role's search depends on.",
    chips: ["Stock in/out", "Approve requests"],
  },
  {
    id: "04",
    title: "Clinic / Small Hospital Staff",
    desc: "Runs the full request-to-resolution flow with no HMS in the background.",
    chips: ["Create request", "Search blood"],
  },
  {
    id: "05",
    title: "Volunteer Donor",
    desc: "Gets alerted only when eligible — recent donation date and distance are filtered automatically.",
    chips: ["Accept/reject", "Certificates"],
  },
  {
    id: "06",
    title: "Patient / Attender",
    desc: "Can raise a request from an ambulance or remote clinic — always pre-linked to a verified facility.",
    chips: ["Guest access", "Live tracking"],
  },
];

const FEATURES = [
  {
    title: "Smart, expanding search",
    desc: "Starts hyper-local, widens the radius automatically the moment nothing nearby matches.",
    icon: <path d="M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-4.3-4.3" />,
  },
  {
    title: "Live inventory",
    desc: "Real-time stock from every connected hospital and blood bank — no stale phone-call data.",
    icon: <path d="M3 3v18h18M7 15l4-4 3 3 5-6" />,
  },
  {
    title: "Eligibility filtering",
    desc: "Donors who recently gave, or don't meet criteria, are filtered out before a single alert is sent.",
    icon: <path d="M12 21s-7-4.6-9.3-9C1 8.5 2 5 5.4 4.1 8 3.4 10.4 4.7 12 7c1.6-2.3 4-3.6 6.6-2.9C22 5 23 8.5 21.3 12 19 16.4 12 21 12 21z" />,
  },
  {
    title: "Multi-channel alerts",
    desc: "Email, SMS, WhatsApp and push — whichever reaches the donor fastest.",
    icon: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  },
  {
    title: "Rare group priority",
    desc: "Rare blood types automatically widen the search area and jump the notification queue.",
    icon: <path d="M9 20l-5.4 2 1.6-5.4A8 8 0 1121 12" />,
  },
  {
    title: "Fastest-source recommendation",
    desc: "Weighs distance, units in stock and travel time to recommend one source — not a list to call through.",
    icon: <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />,
  },
];

const RADAR_NODES = [
  { cls: "n1", label: "St. Mary Hospital" },
  { cls: "n2", label: "City Blood Bank" },
  { cls: "n3", label: "ABC Clinic" },
  { cls: "n4", label: "Donor · O+" },
  { cls: "n5", label: "Donor · B−" },
];

function VerifiedTag() {
  return (
    <span className="verified-tag">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M9 12l2 2 4-4" />
        <circle cx="12" cy="12" r="9" />
      </svg>
      VERIFIED
    </span>
  );
}

export default function LandingPage() {
  const radarRef = useRef(null);
  const navigate = useNavigate();

  // scroll reveal
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // radar node light-up cycle
  useEffect(() => {
    const nodes = radarRef.current?.querySelectorAll("[data-node]") ?? [];
    let timeouts = [];

    function cycle() {
      nodes.forEach((n, i) => {
        const onT = setTimeout(() => {
          n.classList.add("lit");
          const offT = setTimeout(() => n.classList.remove("lit"), 1400);
          timeouts.push(offT);
        }, i * 550);
        timeouts.push(onT);
      });
    }

    cycle();
    const interval = setInterval(cycle, 3600);
    return () => {
      clearInterval(interval);
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="bb-root">
      <header>
        <div className="navbar">
          <a href="#" className="brand">
            <span className="dot"></span>BloodBridge
          </a>
          <nav className="nav-links">
            <a href="#how">How it works</a>
            <a href="#audiences">For hospitals</a>
            <a href="#roles">Roles</a>
            <a href="#features">Features</a>
          </nav>
          <div style={{ display: "flex", gap: 10 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); navigate("/login"); }} className="btn btn-ghost">Log in</a>
            <a href="#" onClick={(e) => { e.preventDefault(); navigate("/emergency-request"); }} className="btn btn-primary">Emergency request</a>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">Live across 40+ verified facilities</div>
            <h1>
              When blood is out of stock, <span>the search shouldn't be manual.</span>
            </h1>
            <p className="lead">
              BloodBridge connects hospitals, blood banks, clinics and verified volunteer
              donors in one live network — so an empty shelf turns into a matched unit in
              minutes, not phone calls.
            </p>
            <div className="hero-ctas">
              <a href="#emergency" className="btn btn-primary">Request blood now — no login</a>
              <button type="button" className="btn btn-ghost" onClick={() => navigate("/donor")}>
                Become a donor
              </button>
            </div>
            <p className="hero-note">
              <b>No hospital or clinic name is ever typed manually</b> — every request links
              to a pre-verified facility, so donors always arrive somewhere real.
            </p>
          </div>

          <div className="radar-wrap" ref={radarRef} aria-hidden="true">
            <div className="radar-ring"></div>
            <div className="radar-ring r2"></div>
            <div className="radar-ring r3"></div>
            <div className="radar-core">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M12 21s-7-4.6-9.3-9C1 8.5 2 5 5.4 4.1 8 3.4 10.4 4.7 12 7c1.6-2.3 4-3.6 6.6-2.9C22 5 23 8.5 21.3 12 19 16.4 12 21 12 21z" />
              </svg>
            </div>
            {RADAR_NODES.map((n) => (
              <div className={`radar-node ${n.cls}`} data-node key={n.cls}>
                <div className="pin"></div>
                <div className="label">{n.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="stats">
        <div className="wrap stats-grid">
          <div className="stat">
            <div className="num">08<span className="unit">min</span></div>
            <div className="lbl">Average time to match a unit</div>
          </div>
          <div className="stat">
            <div className="num">312</div>
            <div className="lbl">Verified donors on standby nearby</div>
          </div>
          <div className="stat">
            <div className="num">96<span className="unit">%</span></div>
            <div className="lbl">Requests resolved without transfer</div>
          </div>
          <div className="stat">
            <div className="num">24/7</div>
            <div className="lbl">Emergency request line, no login</div>
          </div>
        </div>
      </section>

      <section className="section-pad" id="how">
        <div className="wrap">
          <div className="kicker">How it works</div>
          <h2 className="section-title reveal">
            One flow, whether you're a 500-bed hospital or a single-room clinic.
          </h2>
          <p className="section-sub reveal">
            BloodBridge sits alongside your existing systems. It only activates the moment
            blood isn't already on your shelf.
          </p>

          <div className="flow reveal">
            <div className="flow-row">
              <div className="flow-step">
                <div className="tag">STEP 01</div>
                <h4>Emergency logged</h4>
                <p>Reception opens an Emergency ID, or an attender submits a request from a verified facility list.</p>
              </div>
              <div className="flow-step">
                <div className="tag">STEP 02</div>
                <h4>Own stock checked</h4>
                <p>The facility checks its own blood bank first — BloodBridge never replaces that step.</p>
              </div>
              <div className="flow-step yes">
                <div className="tag">IF AVAILABLE</div>
                <h4>Issued on-site</h4>
                <p>Blood is issued through the facility's own procedure. Done in minutes.</p>
              </div>
              <div className="flow-step no">
                <div className="tag">IF NOT AVAILABLE</div>
                <h4>Network search begins</h4>
                <p>Nearby hospitals, blood banks, then eligible donors — radius expands automatically until a match is found.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad section-alt" id="audiences">
        <div className="wrap">
          <div className="kicker">Built for both ends of the system</div>
          <h2 className="section-title reveal">You don't need to replace what already works.</h2>

          <div className="aud-grid reveal">
            <div className="aud-card">
              <div className="aud-badge">LARGE HOSPITALS</div>
              <h3>An extension to your existing HMS</h3>
              <ul>
                <li>Your HMS keeps handling admissions, billing and records — untouched.</li>
                <li>Optional API link sends blood group, units and Emergency ID straight across, no double entry.</li>
                <li>Staff open BloodBridge only when the in-house blood bank comes up short.</li>
                <li>A dedicated Blood Coordinator role keeps this off the general reception queue.</li>
              </ul>
            </div>
            <div className="aud-card">
              <div className="aud-badge">CLINICS &amp; SMALL HOSPITALS</div>
              <h3>Your primary blood coordination system</h3>
              <ul>
                <li>No HMS required — staff log in and raise a request directly.</li>
                <li>Search nearby stock, reserve it, and track status in one screen.</li>
                <li>Attenders can raise a request from an ambulance or remote clinic, pre-linked to a verified facility.</li>
                <li>The facility takes over and verifies the moment they're reachable.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad" id="roles">
        <div className="wrap">
          <div className="kicker">Access, scoped by responsibility</div>
          <h2 className="section-title reveal">Six roles. Each sees only what they need to act fast.</h2>

          <div className="roles-grid reveal">
            {ROLES.map((r) => (
              <div className="badge-card" key={r.id}>
                <div className="badge-top">
                  <VerifiedTag />
                  <span className="badge-id">ROLE / {r.id}</span>
                </div>
                <h4>{r.title}</h4>
                <p className="role-perms">{r.desc}</p>
                <div className="perf-line">
                  {r.chips.map((c) => (
                    <span className="chip" key={c}>{c}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad section-alt" id="features">
        <div className="wrap">
          <div className="kicker">Under the hood</div>
          <h2 className="section-title reveal">
            The details that turn "search everywhere" into "found in 8 minutes."
          </h2>

          <div className="feat-grid reveal">
            {FEATURES.map((f) => (
              <div className="feat" key={f.title}>
                <div className="icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {f.icon}
                  </svg>
                </div>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap cta-wrap" id="emergency">
        <div className="cta-band reveal">
          <div>
            <h3>Need blood right now?</h3>
            <p>Submit an emergency request without an account. Select a verified facility, and the search starts immediately.</p>
          </div>
          <a href="#" onClick={(e) => { e.preventDefault(); navigate("/emergency-request"); }} className="btn btn-primary">Start emergency request →</a>
        </div>
      </section>

      <footer>
        <div className="wrap foot-grid">
          <div className="foot-col">
            <div className="brand" style={{ marginBottom: 12 }}>
              <span className="dot"></span>BloodBridge
            </div>
            <p style={{ color: "var(--ink-dim)", fontSize: 13.5, maxWidth: 280 }}>
              A coordination layer for blood emergencies — not a replacement for hospital
              systems, blood-bank protocol, or medical judgment.
            </p>
          </div>
          <div className="foot-col">
            <h5>Platform</h5>
            <a href="#how">How it works</a>
            <a href="#roles">Roles</a>
            <a href="#features">Features</a>
          </div>
          <div className="foot-col">
            <h5>Get started</h5>
            <a href="#">Hospital registration</a>
            <a href="#">Blood bank registration</a>
            <a href="#" onClick={(e) => { e.preventDefault(); navigate("/donor"); }}>Become a volunteer</a>
          </div>
          <div className="foot-col">
            <h5>Support</h5>
            <a href="#">FAQ</a>
            <a href="#">Contact</a>
            <a href="#">Privacy &amp; terms</a>
          </div>
        </div>
        <div className="wrap foot-bottom">
          <span>© 2026 BloodBridge. All facilities are independently verified.</span>
          <span>Built for hospitals, clinics, blood banks &amp; volunteers.</span>
        </div>
      </footer>
    </div>
  );
}
