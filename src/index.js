import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import facilitiesRoutes from "./routes/facilities.js";
import emergencyRoutes from "./routes/emergency.js";
import contactRoutes from "./routes/contact.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/facilities", facilitiesRoutes);
app.use("/api/emergency-request", emergencyRoutes);
app.use("/api/contact", contactRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`BloodBridge dummy backend running on http://localhost:${PORT}`);
});
