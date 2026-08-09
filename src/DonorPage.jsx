import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./DonorPage.css";

/* ---------------------------------------------------------
   Mock data — replace with real API calls later.
--------------------------------------------------------- */
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const MOCK_EMERGENCY_REQUESTS = [
  { id: "ER-2291", bloodGroup: "O+", hospital: "St. Mary Hospital", distance: "2.1 km", units: 2, urgency: "Critical" },
  { id: "ER-2288", bloodGroup: "B+", hospital: "ABC Clinic", distance: "4.6 km", units: 1, urgency: "High" },
  { id: "ER-2276", bloodGroup: "O+", hospital: "City Blood Bank", distance: "6.0 km", units: 3, urgency: "Moderate" },
];

const MOCK_DONATION_HISTORY = [
  { id: "DN-014", date: "2025-11-02", location: "City Blood Bank", units: 1, status: "Completed" },
  { id: "DN-009", date: "2025-06-18", location: "St. Mary Hospital", units: 1, status: "Completed" },
  { id: "DN-004", date: "2024-12-01", location: "City Blood Bank", units: 1, status: "Completed" },
];

const BADGES = [
  { id: "b1", name: "First Drop", desc: "Completed your first donation", threshold: 1 },
  { id: "b2", name: "Bronze Life Saver", desc: "3 donations completed", threshold: 3 },
  { id: "b3", name: "Silver Life Saver", desc: "5 donations completed", threshold: 5 },
  { id: "b4", name: "Gold Life Saver", desc: "10 donations completed", threshold: 10 },
  { id: "b5", name: "Century Club", desc: "25 donations completed", threshold: 25 },
];

const STEP_LABELS = ["Registration", "Identity", "Blood Group", "Address", "Location", "Eligibility"];

function calcAge(dobStr) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

function monthsBetween(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d;
}

function daysUntil(dateObj) {
  const diff = dateObj.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/* ---------------------------------------------------------
   Small reusable bits
--------------------------------------------------------- */
function Field({ label, hint, error, children }) {
  return (
    <label className="dp-field">
      <span className="dp-field-label">{label}</span>
      {children}
      {hint && !error && <span className="dp-hint">{hint}</span>}
      {error && <span className="dp-error">{error}</span>}
    </label>
  );
}

function VerifiedTag() {
  return (
    <span className="dp-verified">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M9 12l2 2 4-4" />
        <circle cx="12" cy="12" r="9" />
      </svg>
      VERIFIED
    </span>
  );
}

/* ---------------------------------------------------------
   Registration wizard
--------------------------------------------------------- */
function DonorRegistration({ onComplete }) {
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    // step 0
    fullName: "", dob: "", gender: "", email: "", phone: "", password: "", confirmPassword: "",
    // step 1
    aadhaar: "", idFileName: "",
    // step 2
    bloodGroup: "",
    // step 3
    address: "", city: "", state: "", pincode: "",
    // step 4
    lat: "", lng: "", locationStatus: "idle",
    // step 5
    hemoglobinOk: "", weightOver50: "", smoker: "", alcohol: "",
    alcoholFreq: "", chronic: [], lastDonation: "",
  });

  const age = calcAge(form.dob);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleChronic(cond) {
    setForm((f) => ({
      ...f,
      chronic: f.chronic.includes(cond) ? f.chronic.filter((c) => c !== cond) : [...f.chronic, cond],
    }));
  }

  function detectLocation() {
    update("locationStatus", "loading");
    if (!navigator.geolocation) {
      update("locationStatus", "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update("lat", pos.coords.latitude.toFixed(4));
        update("lng", pos.coords.longitude.toFixed(4));
        update("locationStatus", "done");
      },
      () => update("locationStatus", "error")
    );
  }

  function validateStep() {
    const e = {};
    if (step === 0) {
      if (!form.fullName.trim()) e.fullName = "Enter your full name.";
      if (!form.dob) e.dob = "Date of birth is required.";
      else if (age < 18 || age > 65) e.dob = "Donors must be between 18 and 65 years old.";
      if (!form.gender) e.gender = "Select a gender.";
      if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Enter a valid email.";
      if (!/^\d{10}$/.test(form.phone)) e.phone = "Enter a 10-digit phone number.";
      if (!form.password || form.password.length < 8)
  e.password = "Password must be at least 8 characters.";

if (form.password !== form.confirmPassword)
  e.confirmPassword = "Passwords don't match.";
    }
    if (step === 1) {
      if (!/^\d{4}\s?\d{4}\s?\d{4}$/.test(form.aadhaar)) e.aadhaar = "Enter a valid 12-digit Aadhaar number.";
      if (!form.idFileName) e.idFileName = "Upload a photo of your ID.";
    }
    if (step === 2) {
      if (!form.bloodGroup) e.bloodGroup = "Select your blood group.";
    }
    if (step === 3) {
      if (!form.address.trim()) e.address = "Address is required.";
      if (!form.city.trim()) e.city = "City is required.";
      if (!form.state.trim()) e.state = "State is required.";
      if (!/^\d{6}$/.test(form.pincode)) e.pincode = "Enter a valid 6-digit pincode.";
    }
    if (step === 4) {
      if (form.locationStatus !== "done") e.location = "Detect your current location to continue.";
    }
    if (step === 5) {
      if (!form.hemoglobinOk) e.hemoglobinOk = "This is required to check eligibility.";
      if (!form.weightOver50) e.weightOver50 = "This is required to check eligibility.";
      if (!form.smoker) e.smoker = "Please answer this question.";
      if (!form.alcohol) e.alcohol = "Please answer this question.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const eligibility = useMemo(() => {
    if (step < 5 && !form.hemoglobinOk) return null;
    if (form.hemoglobinOk === "no") return { level: "block", label: "Not eligible right now", reason: "Low hemoglobin / red blood cell count needs to be addressed first." };
    if (form.weightOver50 === "no") return { level: "block", label: "Not eligible right now", reason: "Minimum body weight for donation is 50 kg." };
    if (form.chronic.length > 0) return { level: "block", label: "Needs medical review", reason: `Reported condition(s): ${form.chronic.join(", ")}. A doctor must clear this before donating.` };
    if (form.smoker === "yes" || form.alcohol === "yes") return { level: "caution", label: "Eligible, with a note", reason: "Smoking/alcohol use noted — staff will do a quick check-in before your first donation." };
    return { level: "ok", label: "Eligible to donate", reason: "No blocking conditions reported." };
  }, [form.hemoglobinOk, form.weightOver50, form.chronic, form.smoker, form.alcohol, step]);

  function next() {
    if (!validateStep()) return;
    if (step === STEP_LABELS.length - 1) {
      onComplete({ ...form, age, eligibility });
    } else {
      setStep((s) => s + 1);
      setErrors({});
    }
  }
  function back() {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <div className="dp-card dp-wizard">
      <div className="dp-stepper">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className={`dp-step-dot ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}>
            <span className="dp-step-num mono">{i < step ? "✓" : i + 1}</span>
            <span className="dp-step-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="dp-step-body">
        {step === 0 && (
          <>
            <h3>Registration</h3>
            <p className="dp-step-sub">Basic details, including age verification — donors must be 18–65.</p>
            <div className="dp-grid-2">
              <Field label="Full name" error={errors.fullName}>
                <input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder="As on your ID" />
              </Field>
              <Field label="Date of birth" hint={age !== null ? `Age: ${age}` : undefined} error={errors.dob}>
                <input type="date" value={form.dob} onChange={(e) => update("dob", e.target.value)} />
              </Field>
              <Field label="Gender" error={errors.gender} hint="Used to calculate your donation cooldown period.">
                <select value={form.gender} onChange={(e) => update("gender", e.target.value)}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Email" error={errors.email}>
                <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" />
              </Field>
              <Field label="Phone number" error={errors.phone}>
                <input value={form.phone} onChange={(e) => update("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile number" />
              </Field>
              <Field label="Password" error={errors.password}>
              <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="At least 8 characters" />
                </Field>
               <Field label="Confirm password" error={errors.confirmPassword}>
              <input type="password" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} />
                 </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h3>Identity verification</h3>
            <p className="dp-step-sub">We verify every donor before they can appear in a search result — this keeps recipients safe.</p>
            <div className="dp-grid-2">
              <Field label="Aadhaar number" error={errors.aadhaar} hint="Format: 1234 5678 9012">
                <input
                  value={form.aadhaar}
                  onChange={(e) => update("aadhaar", e.target.value.replace(/[^\d\s]/g, "").slice(0, 14))}
                  placeholder="XXXX XXXX XXXX"
                />
              </Field>
              <Field label="Upload ID (front side)" error={errors.idFileName}>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => update("idFileName", e.target.files?.[0]?.name || "")}
                />
                {form.idFileName && <span className="dp-file-chip">{form.idFileName}</span>}
              </Field>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3>Blood group</h3>
            <p className="dp-step-sub">Select the group on your medical record or ID, if known.</p>
            <div className="dp-pill-grid">
              {BLOOD_GROUPS.map((bg) => (
                <button
                  type="button"
                  key={bg}
                  className={`dp-pill ${form.bloodGroup === bg ? "selected" : ""}`}
                  onClick={() => update("bloodGroup", bg)}
                >
                  {bg}
                </button>
              ))}
            </div>
            {errors.bloodGroup && <span className="dp-error">{errors.bloodGroup}</span>}
          </>
        )}

        {step === 3 && (
          <>
            <h3>Address</h3>
            <p className="dp-step-sub">Used to match you with nearby hospitals and blood banks.</p>
            <div className="dp-grid-2">
              <Field label="Street address" error={errors.address}>
                <input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="House no, street, area" />
              </Field>
              <Field label="City" error={errors.city}>
                <input value={form.city} onChange={(e) => update("city", e.target.value)} />
              </Field>
              <Field label="State" error={errors.state}>
                <input value={form.state} onChange={(e) => update("state", e.target.value)} />
              </Field>
              <Field label="Pincode" error={errors.pincode}>
                <input value={form.pincode} onChange={(e) => update("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} />
              </Field>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h3>Current location</h3>
            <p className="dp-step-sub">Emergency requests are matched by live distance, not just your registered address.</p>
            <div className="dp-locate-box">
              <button type="button" className="btn btn-ghost" onClick={detectLocation}>
                📍 Detect my current location
              </button>
              {form.locationStatus === "loading" && <span className="dp-hint">Detecting…</span>}
              {form.locationStatus === "done" && (
                <span className="dp-hint" style={{ color: "var(--vital)" }}>
                  Location captured: {form.lat}, {form.lng}
                </span>
              )}
              {form.locationStatus === "error" && (
                <span className="dp-error">Couldn't get your location — check browser permissions and try again.</span>
              )}
              {errors.location && <span className="dp-error">{errors.location}</span>}
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <h3>Medical eligibility</h3>
            <p className="dp-step-sub">Quick, honest answers here keep both you and recipients safe.</p>
            <div className="dp-grid-2">
              <Field label="Are your hemoglobin / red blood cell levels normal?" error={errors.hemoglobinOk}>
                <select value={form.hemoglobinOk} onChange={(e) => update("hemoglobinOk", e.target.value)}>
                  <option value="">Select</option>
                  <option value="yes">Yes, normal</option>
                  <option value="no">No / told to improve</option>
                  <option value="unsure">Not sure</option>
                </select>
              </Field>
              <Field label="Is your body weight 50 kg or more?" error={errors.weightOver50}>
                <select value={form.weightOver50} onChange={(e) => update("weightOver50", e.target.value)}>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
              <Field label="Do you smoke?" error={errors.smoker}>
                <select value={form.smoker} onChange={(e) => update("smoker", e.target.value)}>
                  <option value="">Select</option>
                  <option value="no">No, non-smoker</option>
                  <option value="yes">Yes, smoker</option>
                </select>
              </Field>
              <Field label="Do you consume alcohol?" error={errors.alcohol}>
                <select value={form.alcohol} onChange={(e) => update("alcohol", e.target.value)}>
                  <option value="">Select</option>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </Field>
              {form.alcohol === "yes" && (
                <Field label="How often?">
                  <select value={form.alcoholFreq} onChange={(e) => update("alcoholFreq", e.target.value)}>
                    <option value="">Select</option>
                    <option value="occasional">Occasionally</option>
                    <option value="weekly">Weekly</option>
                    <option value="daily">Daily</option>
                  </select>
                </Field>
              )}
              <Field label="Last donation date (if any)">
                <input type="date" value={form.lastDonation} onChange={(e) => update("lastDonation", e.target.value)} />
              </Field>
            </div>

            <div className="dp-chronic">
              <span className="dp-field-label">Do you have any of the following?</span>
              <div className="dp-chip-row">
                {["Diabetes", "High blood pressure", "HIV / Hepatitis", "Heart condition"].map((c) => (
                  <button
                    type="button"
                    key={c}
                    className={`chip dp-chip-toggle ${form.chronic.includes(c) ? "selected" : ""}`}
                    onClick={() => toggleChronic(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {eligibility && (
              <div className={`dp-eligibility-banner ${eligibility.level}`}>
                <strong>{eligibility.label}</strong>
                <p>{eligibility.reason}</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="dp-wizard-actions">
        {step > 0 && (
          <button type="button" className="btn btn-ghost" onClick={back}>
            Back
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={next}>
          {step === STEP_LABELS.length - 1 ? "Submit registration" : "Continue"}
        </button>
      </div>
    </div>
  );
}

function RegistrationSuccess({ data, onEnter }) {
  return (
    <div className="dp-card dp-success">
      <div className="dp-success-icon">✓</div>
      <h3>You're registered, {data.fullName.split(" ")[0]}.</h3>
      <p className="dp-step-sub">
        Blood group <b>{data.bloodGroup}</b> · {data.city}, {data.state}
      </p>
      <div className={`dp-eligibility-banner ${data.eligibility.level}`}>
        <strong>{data.eligibility.label}</strong>
        <p>{data.eligibility.reason}</p>
      </div>
      <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={onEnter}>
        Enter donor dashboard →
      </button>
    </div>
  );
}

/* ---------------------------------------------------------
   Donor dashboard
--------------------------------------------------------- */
const NAV_ITEMS = [
  { id: "availability", label: "Availability Status" },
  { id: "emergency", label: "Emergency Requests" },
  { id: "history", label: "Donation History" },
  { id: "certificates", label: "Certificates" },
  { id: "badges", label: "Badges" },
  { id: "profile", label: "Profile" },
  { id: "eligibility", label: "Health Eligibility" },
];

function DonorDashboard({ donor }) {
  const [active, setActive] = useState("availability");
  const [manualUnavailable, setManualUnavailable] = useState(false);

  const cooldownMonths = donor.gender === "Female" ? 4 : 3;
  const lastDonation = MOCK_DONATION_HISTORY[0]?.date || donor.lastDonation;
  const nextEligibleDate = lastDonation ? monthsBetween(lastDonation, cooldownMonths) : null;
  const inCooldown = nextEligibleDate ? nextEligibleDate.getTime() > Date.now() : false;
  const daysLeft = nextEligibleDate ? daysUntil(nextEligibleDate) : 0;

  let status = "available";
  if (inCooldown) status = "cooldown";
  else if (manualUnavailable) status = "manual";

  const matchingRequests = MOCK_EMERGENCY_REQUESTS.filter((r) => r.bloodGroup === donor.bloodGroup || donor.bloodGroup === "O-");

  return (
    <div className="dp-dashboard">
      <aside className="dp-sidebar">
        <div className="dp-sidebar-profile">
          <div className="dp-avatar mono">{donor.fullName?.[0] || "D"}</div>
          <div>
            <div className="dp-sidebar-name">{donor.fullName || "Donor"}</div>
            <div className="dp-sidebar-sub mono">{donor.bloodGroup}</div>
          </div>
        </div>
        <nav className="dp-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`dp-nav-item ${active === item.id ? "active" : ""}`}
              onClick={() => setActive(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="dp-panel">
        {active === "availability" && (
          <section>
            <h2>Availability Status</h2>
            <p className="dp-step-sub">Your status controls whether emergency requests reach you.</p>

            <div className={`dp-status-card ${status}`}>
              <div className="dp-status-dot"></div>
              <div>
                <div className="dp-status-title">
                  {status === "cooldown" && "Unavailable — recovery period"}
                  {status === "manual" && "Unavailable — self-reported"}
                  {status === "available" && "Available to donate"}
                </div>
                <div className="dp-status-desc">
                  {status === "cooldown" &&
                    `Your body needs time to recover. Based on your last donation and a ${cooldownMonths}-month gap for ${donor.gender === "Female" ? "women" : "men"}, you'll be eligible again in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`}
                  {status === "manual" &&
                    "You've marked yourself unavailable (e.g. fever, illness). Switch back whenever you're feeling fine."}
                  {status === "available" &&
                    "You're visible to nearby emergency requests matching your blood group."}
                </div>
              </div>
            </div>

            {!inCooldown && (
              <button
                className={`btn ${manualUnavailable ? "btn-primary" : "btn-ghost"}`}
                style={{ marginTop: 18 }}
                onClick={() => setManualUnavailable((v) => !v)}
              >
                {manualUnavailable ? "I'm feeling fine — mark available" : "Not feeling well — mark unavailable"}
              </button>
            )}
          </section>
        )}

        {active === "emergency" && (
          <section>
            <div className="dp-panel-header">
              <h2>Emergency Requests</h2>
              <span className="dp-soon-badge">🔔 WhatsApp &amp; email alerts — coming soon</span>
            </div>
            <p className="dp-step-sub">Requests below match your blood group and are within range right now.</p>

            <div className="dp-req-list">
              {matchingRequests.map((r) => (
                <div className="dp-req-card" key={r.id}>
                  <div className={`dp-urgency ${r.urgency.toLowerCase()}`}>{r.urgency}</div>
                  <div className="dp-req-main">
                    <div className="dp-req-title">
                      {r.bloodGroup} needed · {r.units} unit{r.units > 1 ? "s" : ""}
                    </div>
                    <div className="dp-req-sub">{r.hospital} · {r.distance} away · <span className="mono">{r.id}</span></div>
                  </div>
                  <div className="dp-req-actions">
                    <button className="btn btn-primary">Accept</button>
                    <button className="btn btn-ghost">Decline</button>
                  </div>
                </div>
              ))}
              {matchingRequests.length === 0 && <p className="dp-hint">No emergency requests match your blood group right now.</p>}
            </div>
          </section>
        )}

        {active === "history" && (
          <section>
            <h2>Donation History</h2>
            <p className="dp-step-sub">Every completed donation is recorded here automatically.</p>
            <table className="dp-table">
              <thead>
                <tr><th>Date</th><th>Location</th><th>Units</th><th>Status</th><th>ID</th></tr>
              </thead>
              <tbody>
                {MOCK_DONATION_HISTORY.map((d) => (
                  <tr key={d.id}>
                    <td>{d.date}</td>
                    <td>{d.location}</td>
                    <td>{d.units}</td>
                    <td><span className="dp-status-chip">{d.status}</span></td>
                    <td className="mono">{d.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {active === "certificates" && (
          <section>
            <h2>Certificates</h2>
            <p className="dp-step-sub">A certificate is generated automatically after each completed donation.</p>
            <div className="dp-cert-grid">
              {MOCK_DONATION_HISTORY.map((d) => (
                <div className="dp-cert-card" key={d.id}>
                  <div className="dp-cert-ribbon">🎖️</div>
                  <div className="dp-cert-title">Donation Certificate</div>
                  <div className="dp-cert-sub mono">{d.id} · {d.date}</div>
                  <button className="btn btn-ghost dp-btn-disabled" disabled>
                    Download — coming soon
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {active === "badges" && (
          <section>
            <h2>Badges</h2>
            <p className="dp-step-sub">Earned automatically as your donation count grows.</p>
            <div className="dp-badge-grid">
              {BADGES.map((b) => {
                const earned = MOCK_DONATION_HISTORY.length >= b.threshold;
                return (
                  <div className={`dp-badge-card ${earned ? "earned" : "locked"}`} key={b.id}>
                    <div className="dp-badge-icon">{earned ? "🏅" : "🔒"}</div>
                    <div className="dp-badge-name">{b.name}</div>
                    <div className="dp-badge-desc">{b.desc}</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {active === "profile" && (
          <section>
            <div className="dp-panel-header">
              <h2>Profile</h2>
              <VerifiedTag />
            </div>
            <div className="dp-profile-grid">
              <div><span className="dp-field-label">Full name</span><div>{donor.fullName}</div></div>
              <div><span className="dp-field-label">Age / Gender</span><div>{donor.age} · {donor.gender}</div></div>
              <div><span className="dp-field-label">Blood group</span><div className="mono">{donor.bloodGroup}</div></div>
              <div><span className="dp-field-label">Phone</span><div>{donor.phone}</div></div>
              <div><span className="dp-field-label">Email</span><div>{donor.email}</div></div>
              <div><span className="dp-field-label">Address</span><div>{donor.address}, {donor.city}, {donor.state} - {donor.pincode}</div></div>
            </div>
          </section>
        )}

        {active === "eligibility" && (
          <section>
            <h2>Health Eligibility</h2>
            <p className="dp-step-sub">Reviewed at registration. We recommend re-checking every 6 months.</p>
            <div className={`dp-eligibility-banner ${donor.eligibility.level}`}>
              <strong>{donor.eligibility.label}</strong>
              <p>{donor.eligibility.reason}</p>
            </div>
            <button className="btn btn-ghost" style={{ marginTop: 16 }}>Update health details</button>
          </section>
        )}
      </main>
    </div>
  );
}

/* ---------------------------------------------------------
   Page root — switches between wizard, success, dashboard
--------------------------------------------------------- */
export default function DonorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialPhase = location.state?.loggedIn ? "dashboard" : location.state?.startRegister ? "register" : "choice";
  const [phase, setPhase] = useState(initialPhase); // choice | register | success | dashboard
  const [donorData, setDonorData] = useState(
    location.state?.loggedIn
      ? {
          fullName: location.state.user?.name || "Donor",
          gender: "Male",
          age: 27,
          bloodGroup: location.state.user?.bloodGroup || "O+",
          email: "on-file@example.com",
          phone: "9876543210",
          address: "On file", city: "Coimbatore", state: "Tamil Nadu", pincode: "641001",
          eligibility: { level: "ok", label: "Eligible to donate", reason: "No blocking conditions reported." },
        }
      : null
  );

  return (
    <div className="dp-root">
      <header className="dp-header">
        <div className="wrap dp-header-inner">
          <a href="/" className="brand"><span className="dot"></span>BloodBridge</a>
          <span className="dp-header-tag">Become a Donor</span>
        </div>
      </header>

      <div className="wrap dp-content">
        {phase === "choice" && (
          <div className="dp-choice">
            <h1>Become a donor</h1>
            <p className="dp-step-sub" style={{ maxWidth: 480 }}>
              Register once, get verified, and BloodBridge alerts you only when a nearby emergency matches your blood group.
            </p>
            <div className="dp-choice-actions">
              <button className="btn btn-primary" onClick={() => setPhase("register")}>New donor — register</button>
              <button className="btn btn-ghost" onClick={() => navigate("/login?role=donor")}>
                Already registered — log in
              </button>
            </div>
          </div>
        )}

        {phase === "register" && (
          <DonorRegistration
            onComplete={(data) => {
              setDonorData(data);
              setPhase("success");
            }}
          />
        )}

        {phase === "success" && donorData && (
          <RegistrationSuccess data={donorData} onEnter={() => setPhase("dashboard")} />
        )}

        {phase === "dashboard" && donorData && <DonorDashboard donor={donorData} />}
      </div>
    </div>
  );
}
