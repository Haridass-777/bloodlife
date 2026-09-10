import { useNavigate } from "react-router-dom";
import "./AuthPages.css";

export default function SignupPage() {
  const navigate = useNavigate();

  return (
    <div className="auth-root">
      <header className="auth-header">
        <div className="wrap auth-header-inner">
          <a href="/" className="brand"><span className="dot"></span>BloodBridge</a>
        </div>
      </header>

      <div className="wrap auth-content">
        <div className="auth-card auth-card-wide">
          <h1>Sign up</h1>
          <p className="auth-sub">Choose which kind of account you're creating.</p>

          <div className="signup-grid">
            <div className="signup-option">
              <div className="signup-tag">OPEN TO EVERYONE</div>
              <h3>I'm an individual donor</h3>
              <p>Register directly — you'll go through identity verification, blood group, and a short medical eligibility check.</p>
              <button className="btn btn-primary" onClick={() => navigate("/donor")}>
                Register as a donor →
              </button>
            </div>

            <div className="signup-option">
              <div className="signup-tag alt">VERIFICATION REQUIRED</div>
              <h3>I represent a hospital, clinic, or blood bank</h3>
              <p>These accounts can't self-register. Our team verifies every facility before it's allowed to appear in searches or receive requests.</p>
              <button className="btn btn-ghost" onClick={() => navigate("/contact-us")}>
                Contact us to get verified →
              </button>
            </div>
          </div>

          <p className="auth-footnote">
            Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); navigate("/login"); }}>Log in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
