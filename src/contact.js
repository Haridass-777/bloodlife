import express from "express";
import { contactMessages } from "../data.js";

const router = express.Router();

// POST /api/contact
// body: { orgName, orgType, email, phone, message }
router.post("/", (req, res) => {
  const { orgName, orgType, email, phone, message } = req.body || {};
  if (!orgName || !orgType || !email || !phone) {
    return res.status(400).json({ error: "Organization name, type, email and phone are required." });
  }

  const record = {
    id: `MSG-${contactMessages.length + 1}`,
    orgName, orgType, email, phone,
    message: message || "",
    createdAt: new Date().toISOString(),
    status: "pending_review",
  };
  contactMessages.push(record);
  res.status(201).json(record);
});

export default router;
