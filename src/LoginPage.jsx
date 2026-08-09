import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login } from "./services/authService";
import "./AuthPages.css";

const ROLES = [
  { id: "hospital", label: "Hospital" },
  { id: "clinic", label: "Clinic" },
  { id: "bloodbank", label: "Blood Bank" },
  { id: "donor", label: "Donor" },
];

function makeCaptcha() {
  const a = Math.floor(Math.random() * 8) + 1;
  const b = Math.floor(Math.random() * 8) + 1;
  return { a, b, answer: a + b };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselect = searchParams.get("role");

  const [role, setRole] = useState(ROLES.some((r) => r.id === preselect) ? preselect : "hospital");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [captcha, setCaptcha] = useState(makeCaptcha());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError("");
  }, [role]);

  function refreshCaptcha() {
    setCaptcha(makeCaptcha());
    setCaptchaInput("");
  }

  async function handleSubmit(e) {
  e.preventDefault();

  setError("");
  setLoading(true);

  try {
    // Check captcha
    if (Number(captchaInput) !== captcha.answer) {
      throw new Error("Invalid captcha.");
    }

    // Login using Supabase
    const user = await login(
      role,
      email.trim().toLowerCase(),
      password
    );

    // Navigate based on role
    if (role === "donor") {
      navigate("/donor", {
        state: {
          loggedIn: true,
          user,
        },
      });
    } else if (role === "hospital" || role === "clinic" || role === "bloodbank") {
      // All facility-side roles land on the same dashboard —
      // it adapts (inventory / requests / matches / profile) per role.
      navigate("/facility", {
        state: {
          facilityUser: user,
        },
      });
    } else {
      navigate("/");
    }
  } catch (err) {
    setError(err.message || "Login failed.");
    refreshCaptcha();
  } finally {
    setLoading(false);
  }
}
  const activeRole = ROLES.find((r) => r.id === role);

  return (
    <div className="auth-root">
      <header className="auth-header">
        <div className="wrap auth-header-inner">
          <a href="/" className="brand"><span className="dot"></span>BloodBridge</a>
        </div>
      </header>

      <div className="wrap auth-content">
        <div className="auth-card">
          <h1>Log in</h1>
          <p className="auth-sub">Select your role to continue.</p>

          <div className="role-grid">
            {ROLES.map((r) => (
              <button
                type="button"
                key={r.id}
                className={`role-pill ${role === r.id ? "selected" : ""}`}
                onClick={() => setRole(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-field">
             <span>Email</span>

            <input
              type="email"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              placeholder="Enter your email" 
              required
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>

            <div className="captcha-box">
              <div className="captcha-question mono">
                {captcha.a} + {captcha.b} = ?
                <button type="button" className="captcha-refresh" onClick={refreshCaptcha} title="New captcha">↻</button>
              </div>
              <input
                className="captcha-input"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                placeholder="Your answer"
                required
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? "Logging in…" : "Log in"}
            </button>
          </form>

          {role === "donor" && (
            <p className="auth-footnote">
              Not a donor yet? <a href="#" onClick={(e) => { e.preventDefault(); navigate("/signup"); }}>Sign up here</a>
            </p>
          )}
          {role !== "donor" && (
            <p className="auth-footnote">
              Representing an unverified facility? <a href="#" onClick={(e) => { e.preventDefault(); navigate("/signup"); }}>See how to join</a>
            </p>
          )}

        </div>
      </div>
    </div>
  );
}
