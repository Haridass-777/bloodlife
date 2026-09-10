import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  registerDonor,
  getDonorProfile,
  getDonorRequestHistory,
  updateDonorAvailability,
} from "./services/donorService";
import { findRequestsForDonor, updateDonorResponse } from "./services/searchService";
import "./DonorPage.css";

// ============================================
// CONSTANTS
// ============================================
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const BADGES = [
  { id: "b1", name: "First Drop", desc: "Completed your first donation", threshold: 1 },
  { id: "b2", name: "Bronze Life Saver", desc: "3 donations completed", threshold: 3 },
  { id: "b3", name: "Silver Life Saver", desc: "5 donations completed", threshold: 5 },
  { id: "b4", name: "Gold Life Saver", desc: "10 donations completed", threshold: 10 },
  { id: "b5", name: "Century Club", desc: "25 donations completed", threshold: 25 },
];

const STEP_LABELS = ["Registration", "Identity", "Blood Group", "Address", "Location", "Eligibility"];

const NAV_ITEMS = [
  { id: "overview", label: "Availability" },
  { id: "requests", label: "Nearby Requests" },
  { id: "history", label: "Donation History" },
  { id: "certificates", label: "Certificates" },
  { id: "badges", label: "Badges" },
  { id: "profile", label: "Profile" },
];

// ============================================
// HELPERS
// ============================================
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

// ============================================
// FIELD / VERIFIED TAG
// ============================================
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

// ============================================
// REGISTRATION WIZARD (class names now match DonorPage.css)
// ============================================
function DonorRegistration({ onComplete, submitting }) {
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    fullName: "",
    dob: "",
    gender: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    aadhaar: "",
    idFileName: "",
    bloodGroup: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    lat: "",
    lng: "",
    locationStatus: "idle",
    hemoglobinOk: "",
    weightOver50: "",
    smoker: "",
    alcohol: "",
    alcoholFreq: "",
    chronic: [],
    lastDonation: "",
  });

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) {
      setErrors((e) => ({ ...e, [key]: "" }));
    }
  }

  function toggleChronic(condition) {
    setForm((f) => ({
      ...f,
      chronic: f.chronic.includes(condition)
        ? f.chronic.filter((c) => c !== condition)
        : [...f.chronic, condition],
    }));
  }

  function validateStep() {
    const newErrors = {};

    if (step === 0) {
      if (!form.fullName.trim()) newErrors.fullName = "Name required";
      if (!form.dob) newErrors.dob = "Date of birth required";
      else if (calcAge(form.dob) < 18) newErrors.dob = "Must be 18 or older";
      if (!form.gender) newErrors.gender = "Select gender";
      if (!form.email.includes("@")) newErrors.email = "Valid email required";
      if (form.phone.length < 10) newErrors.phone = "Valid phone required";
      if (form.password.length < 6) newErrors.password = "Min 6 characters";
      if (form.password !== form.confirmPassword) newErrors.confirmPassword = "Passwords don't match";
    }

    if (step === 1) {
      if (form.aadhaar && form.aadhaar.length !== 12) newErrors.aadhaar = "Aadhaar is 12 digits";
    }

    if (step === 2) {
      if (!form.bloodGroup) newErrors.bloodGroup = "Select blood group";
    }

    if (step === 3) {
      if (!form.address.trim()) newErrors.address = "Address required";
      if (!form.city.trim()) newErrors.city = "City required";
      if (!form.pincode.match(/^\d{5,6}$/)) newErrors.pincode = "Valid pincode required";
    }

    if (step === 4) {
      if (form.locationStatus !== "success") newErrors.location = "Enable location to continue";
    }

    if (step === 5) {
      if (!form.hemoglobinOk) newErrors.hemoglobinOk = "Required";
      if (!form.weightOver50) newErrors.weightOver50 = "Required";
      if (!form.smoker) newErrors.smoker = "Required";
      if (!form.alcohol) newErrors.alcohol = "Required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleNext() {
    if (!validateStep()) return;
    if (step < STEP_LABELS.length - 1) {
      setStep(step + 1);
    }
  }

  async function handleSubmit() {
    if (!validateStep()) return;

    try {
      await onComplete({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        dob: form.dob,
        gender: form.gender,
        bloodGroup: form.bloodGroup,
        address: form.address,
        city: form.city,
        state: form.state || "",
        pincode: form.pincode,
        lat: form.lat,
        lng: form.lng,
        aadhaar: form.aadhaar || null,
        hemoglobinOk: form.hemoglobinOk,
        weightOver50: form.weightOver50,
        smoker: form.smoker,
        alcohol: form.alcohol,
        alcoholFreq: form.alcoholFreq || null,
        chronic: form.chronic,
        lastDonation: form.lastDonation || null,
      });
    } catch (err) {
      setErrors({ submit: err.message });
    }
  }

  function getLocation() {
    if (!navigator.geolocation) {
      setErrors({ location: "Geolocation not supported" });
      return;
    }

    update("locationStatus", "loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        update("lat", pos.coords.latitude.toString());
        update("lng", pos.coords.longitude.toString());
        update("locationStatus", "success");
      },
      () => {
        update("locationStatus", "error");
        setErrors({ location: "Could not get location" });
      }
    );
  }

  return (
    <div className="dp-card">
      <div className="dp-stepper">
        {STEP_LABELS.map((label, i) => (
          <div
            key={i}
            className={`dp-step-dot ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
          >
            <span className="dp-step-num">{i < step ? "✓" : i + 1}</span>
            <span className="dp-step-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="dp-step-body">
        {/* STEP 0: Registration */}
        {step === 0 && (
          <section>
            <h3>Create your donor account</h3>
            <p className="dp-step-sub">Full name, date of birth, and contact info. We verify everything.</p>

            <div className="dp-grid-2">
              <Field label="Full name" error={errors.fullName}>
                <input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} />
              </Field>
              <Field label="Date of birth" error={errors.dob} hint="Must be 18+">
                <input type="date" value={form.dob} onChange={(e) => update("dob", e.target.value)} />
              </Field>
              <Field label="Gender" error={errors.gender}>
                <select value={form.gender} onChange={(e) => update("gender", e.target.value)}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Email" error={errors.email}>
                <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
              </Field>
              <Field label="Mobile" error={errors.phone}>
                <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
              </Field>
              <Field label="Password" error={errors.password} hint="Min 6 characters">
                <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} />
              </Field>
              <Field label="Confirm password" error={errors.confirmPassword}>
                <input type="password" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} />
              </Field>
            </div>
          </section>
        )}

        {/* STEP 1: Identity */}
        {step === 1 && (
          <section>
            <h3>Identity verification</h3>
            <p className="dp-step-sub">Aadhaar or government ID (optional but recommended).</p>

            <div className="dp-grid-2">
              <Field label="Aadhaar (optional)" error={errors.aadhaar} hint="12-digit number">
                <input type="text" value={form.aadhaar} onChange={(e) => update("aadhaar", e.target.value)} maxLength="12" />
              </Field>
              <Field label="ID file name (optional)">
                <input type="text" value={form.idFileName} onChange={(e) => update("idFileName", e.target.value)} placeholder="e.g., passport.pdf" />
              </Field>
            </div>
          </section>
        )}

        {/* STEP 2: Blood Group */}
        {step === 2 && (
          <section>
            <h3>Blood group</h3>
            <p className="dp-step-sub">This is how hospitals find you.</p>

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
            {errors.bloodGroup && <div className="dp-error" style={{ marginTop: 10 }}>{errors.bloodGroup}</div>}
          </section>
        )}

        {/* STEP 3: Address */}
        {step === 3 && (
          <section>
            <h3>Address</h3>
            <p className="dp-step-sub">So we can calculate distance to emergency requests.</p>

            <div className="dp-grid-2">
              <Field label="Address" error={errors.address}>
                <input value={form.address} onChange={(e) => update("address", e.target.value)} />
              </Field>
              <Field label="City" error={errors.city}>
                <input value={form.city} onChange={(e) => update("city", e.target.value)} />
              </Field>
              <Field label="State">
                <input value={form.state} onChange={(e) => update("state", e.target.value)} />
              </Field>
              <Field label="Pincode" error={errors.pincode} hint="5-6 digits">
                <input value={form.pincode} onChange={(e) => update("pincode", e.target.value)} />
              </Field>
            </div>
          </section>
        )}

        {/* STEP 4: Location */}
        {step === 4 && (
          <section>
            <h3>Enable location access</h3>
            <p className="dp-step-sub">Donors within X km get the alert first.</p>

            <div className="dp-locate-box">
              {form.locationStatus === "success" && (
                <p>Location captured: {parseFloat(form.lat).toFixed(4)}, {parseFloat(form.lng).toFixed(4)}</p>
              )}
              {form.locationStatus === "loading" && <p className="dp-hint">Getting location…</p>}
              {form.locationStatus === "error" && <p className="dp-error">Could not get location. Try again.</p>}
              {form.locationStatus !== "success" && (
                <button type="button" className="btn btn-primary" onClick={getLocation}>
                  Enable location
                </button>
              )}
              {errors.location && <p className="dp-error">{errors.location}</p>}
            </div>
          </section>
        )}

        {/* STEP 5: Eligibility */}
        {step === 5 && (
          <section>
            <h3>Medical eligibility</h3>
            <p className="dp-step-sub">Answer honestly. Ineligible donors are filtered out before any alert is sent.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 20 }}>
              <Field label="Hemoglobin OK?" error={errors.hemoglobinOk}>
                <select value={form.hemoglobinOk} onChange={(e) => update("hemoglobinOk", e.target.value)}>
                  <option value="">Select</option>
                  <option value="yes">Yes, hemoglobin is OK (12.5+ g/dL)</option>
                  <option value="no">No, low hemoglobin</option>
                </select>
              </Field>

              <Field label="Weight over 50 kg?" error={errors.weightOver50}>
                <select value={form.weightOver50} onChange={(e) => update("weightOver50", e.target.value)}>
                  <option value="">Select</option>
                  <option value="yes">Yes, over 50 kg</option>
                  <option value="no">No, under 50 kg</option>
                </select>
              </Field>

              <Field label="Do you smoke?" error={errors.smoker}>
                <select value={form.smoker} onChange={(e) => update("smoker", e.target.value)}>
                  <option value="">Select</option>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
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
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="occasional">Occasional</option>
                  </select>
                </Field>
              )}

              <div className="dp-chronic">
                <label className="dp-field-label">Chronic conditions</label>
                <div className="dp-chip-row">
                  {["Diabetes", "Hypertension", "Heart disease", "Hepatitis", "HIV/AIDS"].map((c) => (
                    <button
                      type="button"
                      key={c}
                      className={`dp-chip-toggle chip ${form.chronic.includes(c) ? "selected" : ""}`}
                      onClick={() => toggleChronic(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <Field label="Last donation date (optional)">
                <input type="date" value={form.lastDonation} onChange={(e) => update("lastDonation", e.target.value)} />
              </Field>
            </div>
          </section>
        )}

        {errors.submit && <div className="dp-error" style={{ marginTop: 20 }}>{errors.submit}</div>}
      </div>

      <div className="dp-wizard-actions">
        {step > 0 && (
          <button className="btn btn-ghost" onClick={() => setStep(step - 1)} disabled={submitting}>
            ← Back
          </button>
        )}
        {step < STEP_LABELS.length - 1 ? (
          <button className="btn btn-primary" onClick={handleNext} disabled={submitting}>
            Next →
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating account…" : "Complete registration"}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// SUCCESS SCREEN
// ============================================
function SuccessScreen({ profile }) {
  const navigate = useNavigate();
  const age = calcAge(profile.dob);
  const eligibleBadges = BADGES.filter((b) => b.threshold <= 1).map((b) => b.name).join(", ");

  return (
    <div className="dp-root">
      <header className="dp-header">
        <div className="wrap dp-header-inner">
          <a href="/" className="brand"><span className="dot"></span>BloodBridge</a>
        </div>
      </header>

      <div className="wrap dp-content">
        <div className="dp-card dp-success">
          <div className="dp-success-icon">✓</div>
          <h2>Welcome, {profile.fullName}!</h2>
          <p className="dp-step-sub">
            Your account is ready. You'll receive alerts when your blood group is needed nearby.
          </p>

          <div style={{ marginTop: 24, marginBottom: 20 }}>
            <h3>{profile.bloodGroup}</h3>
            <p className="dp-step-sub">{profile.city}{profile.state ? `, ${profile.state}` : ""}</p>
            <p className="dp-step-sub">Age: {age} | {profile.gender}</p>
          </div>

          <div className={`dp-eligibility-banner ${profile.eligibility.level}`}>
            {profile.eligibility.level === "ok" && (
              <>
                <strong>✓ Eligible to donate</strong>
                <p>{eligibleBadges}</p>
              </>
            )}
            {profile.eligibility.level === "caution" && (
              <>
                <strong>⚠ Review needed</strong>
                <p>{profile.eligibility.reason}</p>
              </>
            )}
            {profile.eligibility.level === "block" && (
              <>
                <strong>✕ Not eligible right now</strong>
                <p>{profile.eligibility.reason}</p>
              </>
            )}
          </div>

          <div style={{ marginTop: 32, display: "flex", gap: 12, justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => navigate("/")}>Back to home</button>
            <button className="btn btn-ghost" onClick={() => navigate("/login")}>Log in</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// DASHBOARD PANELS
// ============================================
function AvailabilityPanel({ profile, onRefresh }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  if (!profile) return null;

  const eligibility = profile.eligibility || { level: "ok", reason: "" };
  const cooldownUntil = profile.lastDonation ? monthsBetween(profile.lastDonation, 3) : null;
  const inCooldown = cooldownUntil && daysUntil(cooldownUntil) > 0;

  let statusClass = "available";
  let title = "Available to donate";
  let desc = "You'll receive alerts when your blood group is needed nearby.";

  if (eligibility.level === "block") {
    statusClass = "manual";
    title = "Not eligible right now";
    desc = eligibility.reason;
  } else if (inCooldown) {
    statusClass = "cooldown";
    title = "Cooling down";
    desc = `You can donate again in ${daysUntil(cooldownUntil)} day(s).`;
  } else if (!profile.available) {
    statusClass = "manual";
    title = "Marked unavailable";
    desc = "You've turned off alerts. Toggle back on when you're ready.";
  }

  async function toggle() {
    setSaving(true);
    setError("");
    try {
      await updateDonorAvailability(profile.id, !profile.available);
      await onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2>Availability</h2>
      <p className="dp-step-sub">Toggle whether you can be alerted right now.</p>

      <div className={`dp-status-card ${statusClass}`}>
        <div className="dp-status-dot"></div>
        <div>
          <div className="dp-status-title">{title}</div>
          <div className="dp-status-desc">{desc}</div>
        </div>
      </div>

      {error && <div className="dp-error" style={{ marginTop: 12 }}>{error}</div>}

      {eligibility.level !== "block" && !inCooldown && (
        <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={toggle} disabled={saving}>
          {saving ? "Saving…" : profile.available ? "Turn off alerts" : "Turn on alerts"}
        </button>
      )}
    </section>
  );
}

function NearbyRequestsPanel({ profile }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await findRequestsForDonor(profile.id, profile.latitude, profile.longitude);
      setRequests(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [profile.id, profile.latitude, profile.longitude]);

  useEffect(() => { load(); }, [load]);

  async function respond(requestId, status) {
    setActingId(requestId);
    try {
      await updateDonorResponse(requestId, profile.id, status);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId(null);
    }
  }

  return (
    <section>
      <h2>Nearby Emergency Requests</h2>
      <p className="dp-step-sub">Matches for your blood group within range.</p>
      {error && <div className="dp-error">{error}</div>}
      {loading ? (
        <p className="dp-hint">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="dp-hint">No matching requests right now.</p>
      ) : (
        <div className="dp-req-list">
          {requests.map((r) => (
            <div className="dp-req-card" key={r.id}>
              <div className={`dp-urgency ${r.priority}`}>{r.priority}</div>
              <div className="dp-req-main">
                <div className="dp-req-title">
                  {r.blood_group} needed · {r.units_required} unit{r.units_required > 1 ? "s" : ""}
                </div>
                <div className="dp-req-sub">
                  {r.distanceKm != null ? `${r.distanceKm} km away · ` : ""}{r.hospital_name || "Unknown facility"}
                </div>
              </div>
              <div className="dp-req-actions">
                <button className="btn btn-primary" disabled={actingId === r.id} onClick={() => respond(r.id, "accepted")}>Accept</button>
                <button className="btn btn-ghost" disabled={actingId === r.id} onClick={() => respond(r.id, "rejected")}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function HistoryPanel({ donorId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setRows(await getDonorRequestHistory(donorId));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [donorId]);

  return (
    <section>
      <h2>Donation History</h2>
      <p className="dp-step-sub">Every request you've responded to.</p>
      {error && <div className="dp-error">{error}</div>}
      {loading ? (
        <p className="dp-hint">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="dp-hint">No history yet.</p>
      ) : (
        <table className="dp-table">
          <thead>
            <tr><th>Date</th><th>Blood group</th><th>Patient</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="mono">{r.emergency_requests?.blood_group}</td>
                <td>{r.emergency_requests?.patient_name || "Unknown"}</td>
                <td><span className="dp-status-chip">{r.request_status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function CertificatesPanel() {
  return (
    <section>
      <div className="dp-panel-header">
        <h2>Certificates</h2>
        <span className="dp-soon-badge">Coming soon</span>
      </div>
      <p className="dp-step-sub">Digital certificates for completed donations will appear here.</p>
    </section>
  );
}

function BadgesPanel({ completedCount }) {
  return (
    <section>
      <h2>Badges</h2>
      <p className="dp-step-sub">Earned automatically as you complete donations.</p>
      <div className="dp-badge-grid">
        {BADGES.map((b) => {
          const earned = completedCount >= b.threshold;
          return (
            <div className={`dp-badge-card ${earned ? "" : "locked"}`} key={b.id}>
              <div className="dp-badge-icon">🏅</div>
              <div className="dp-badge-name">{b.name}</div>
              <div className="dp-badge-desc">{b.desc}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DonorProfilePanel({ profile }) {
  if (!profile) return null;
  return (
    <section>
      <div className="dp-panel-header">
        <h2>Profile</h2>
        {profile.verified && <VerifiedTag />}
      </div>
      <div className="dp-profile-grid">
        <div><span className="dp-field-label">Full name</span><div>{profile.fullName}</div></div>
        <div><span className="dp-field-label">Blood group</span><div className="mono">{profile.bloodGroup}</div></div>
        <div><span className="dp-field-label">Email</span><div>{profile.email}</div></div>
        <div><span className="dp-field-label">Phone</span><div>{profile.phone}</div></div>
        <div><span className="dp-field-label">City</span><div>{profile.city}{profile.state ? `, ${profile.state}` : ""}</div></div>
        <div><span className="dp-field-label">Address</span><div>{profile.address}</div></div>
        <div><span className="dp-field-label">Last donation</span><div>{profile.lastDonation ? new Date(profile.lastDonation).toLocaleDateString() : "Never"}</div></div>
        <div><span className="dp-field-label">Eligibility</span><div>{profile.eligibility?.reason}</div></div>
      </div>
    </section>
  );
}

// ============================================
// DONOR DASHBOARD (logged-in view — this was missing entirely)
// ============================================
function DonorDashboard({ user }) {
  const [active, setActive] = useState("overview");
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getDonorProfile(user.id);
      setProfile(p);
      setHistory(await getDonorRequestHistory(p.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const completedCount = history.filter((h) => h.request_status === "accepted").length;

  if (loading) {
    return (
      <div className="dp-root">
        <div className="wrap dp-content"><p className="dp-hint">Loading your dashboard…</p></div>
      </div>
    );
  }

  return (
    <div className="dp-root">
      <header className="dp-header">
        <div className="wrap dp-header-inner">
          <a href="/" className="brand"><span className="dot"></span>BloodBridge</a>
          <span className="dp-header-tag">{user.full_name}</span>
        </div>
      </header>

      <div className="wrap dp-content">
        {error && <div className="dp-error" style={{ marginBottom: 20 }}>{error}</div>}
        <div className="dp-dashboard">
          <aside className="dp-sidebar">
            <div className="dp-sidebar-profile">
              <div className="dp-avatar mono">{user.full_name?.[0] || "D"}</div>
              <div>
                <div className="dp-sidebar-name">{user.full_name}</div>
                <div className="dp-sidebar-sub mono">{user.user_code}</div>
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
            {active === "overview" && <AvailabilityPanel profile={profile} onRefresh={load} />}
            {active === "requests" && profile && <NearbyRequestsPanel profile={profile} />}
            {active === "history" && profile && <HistoryPanel donorId={profile.id} />}
            {active === "certificates" && <CertificatesPanel />}
            {active === "badges" && <BadgesPanel completedCount={completedCount} />}
            {active === "profile" && <DonorProfilePanel profile={profile} />}
          </main>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN DONOR PAGE
// ============================================
export default function DonorPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // This is the missing piece: LoginPage sends state.loggedIn + state.user,
  // but nothing here was checking for it before.
  const loggedInUser = location.state?.loggedIn ? location.state?.user : null;

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [profile, setProfile] = useState(null);

  async function handleRegistrationComplete(formData) {
    setSubmitting(true);
    try {
      const result = await registerDonor(formData);
      setProfile(result);
      setSuccess(true);
    } catch (err) {
      alert(`Registration failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loggedInUser) {
    return <DonorDashboard user={loggedInUser} />;
  }

  if (success && profile) {
    return <SuccessScreen profile={profile} />;
  }

  return (
    <div className="dp-root">
      <header className="dp-header">
        <div className="wrap dp-header-inner">
          <a href="/" className="brand"><span className="dot"></span>BloodBridge</a>
          <button className="btn btn-ghost" onClick={() => navigate("/login")} type="button">
            Log in
          </button>
        </div>
      </header>

      <div className="wrap dp-content">
        <div className="dp-choice">
          <VerifiedTag />
          <h1>Become a verified donor</h1>
          <p className="dp-step-sub">In minutes, you could save a life. Hospitals and blood banks find you when you're the right match.</p>
        </div>

        <DonorRegistration onComplete={handleRegistrationComplete} submitting={submitting} />
      </div>
    </div>
  );
}