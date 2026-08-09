import express from "express";
import { users } from "../data.js";

const router = express.Router();

const ID_PATTERNS = {
  hospital: /^HOSP-\d{4}$/,
  clinic: /^CLN-\d{4}$/,
  bloodbank: /^BB-\d{4}$/,
  donor: /^DNR-\d{4}$/,
};

// POST /api/auth/login
// body: { role, id, password, captchaAnswer, captchaExpected }
router.post("/login", (req, res) => {
  const { role, id, password, captchaAnswer, captchaExpected } = req.body;

  if (!role || !ID_PATTERNS[role]) {
    return res.status(400).json({ error: "Select a valid role (hospital, clinic, bloodbank, donor)." });
  }
  if (!ID_PATTERNS[role].test(id || "")) {
    return res.status(400).json({ error: `ID format looks wrong for ${role}.` });
  }
  if (String(captchaAnswer) !== String(captchaExpected)) {
    return res.status(400).json({ error: "Captcha answer is incorrect." });
  }

  const user = users.find((u) => u.id === id && u.role === role);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid ID or password." });
  }

  // Dummy token — replace with real JWT once a database exists.
  const token = `dummy-token-${user.id}-${Date.now()}`;

  return res.json({
    token,
    user: {
      id: user.id,
      role: user.role,
      name: user.name,
      facilityId: user.facilityId || null,
      bloodGroup: user.bloodGroup || null,
    },
  });
});

export default router;
