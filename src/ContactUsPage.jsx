import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { submitContactForm } from "./api";
import "./AuthPages.css";

export default function ContactUsPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ orgName: "", orgType: "hospital", email: "", phone: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await submitContactForm(form);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-root">
      <header className="auth-header">
        <div className="wrap auth-header-inner">
          <a href="/" className="brand"><span className="dot"></span>BloodBridge</a>
        </div>
      </header>

      <div className="wrap auth-content">
        <div className="auth-card">
          {!submitted ? (
            <>
              <h1>Join as a verified facility</h1>
              <p className="auth-sub">
                Hospitals, clinics, and blood banks can't self-register — every facility is verified by our team
                first, so donors always arrive somewhere real. Tell us about yours and we'll follow up.
              </p>

              <form onSubmit={handleSubmit} className="contact-form">
                <label className="auth-field">
                  <span>Organization name</span>
                  <input value={form.orgName} onChange={(e) => update("orgName", e.target.value)} required />
                </label>

                <label className="auth-field">
                  <span>Organization type</span>
                  <select
                    value={form.orgType}
                    onChange={(e) => update("orgType", e.target.value)}
                    style={{ background: "var(--void)", border: "1px solid var(--charcoal)", color: "var(--ink)", padding: "12px 14px", borderRadius: "9px", fontSize: "14.5px" }}
                  >
                    <option value="hospital">Hospital</option>
                    <option value="clinic">Clinic</option>
                    <option value="bloodbank">Blood Bank</option>
                  </select>
                </label>

                <div className="contact-grid-2">
                  <label className="auth-field">
                    <span>Contact email</span>
                    <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
                  </label>
                  <label className="auth-field">
                    <span>Contact phone</span>
                    <input value={form.phone} onChange={(e) => update("phone", e.target.value)} required />
                  </label>
                </div>

                <label className="auth-field">
                  <span>Anything else we should know? (optional)</span>
                  <textarea
                    rows={4}
                    value={form.message}
                    onChange={(e) => update("message", e.target.value)}
                    style={{ background: "var(--void)", border: "1px solid var(--charcoal)", color: "var(--ink)", padding: "12px 14px", borderRadius: "9px", fontSize: "14.5px", fontFamily: "inherit", resize: "vertical" }}
                  />
                </label>

                {error && <div className="auth-error">{error}</div>}

                <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                  {loading ? "Sending…" : "Submit for verification"}
                </button>
              </form>
            </>
          ) : (
            <div className="contact-success">
              <div className="contact-success-icon">✓</div>
              <h3>Thanks — we've got it.</h3>
              <p className="auth-sub">Our verification team will reach out to the contact details you provided.</p>
              <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={() => navigate("/")}>
                Back to home
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
