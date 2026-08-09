import express from "express";
import { facilities } from "../data.js";

const router = express.Router();

// GET /api/facilities?type=hospital|clinic
// Only verified facilities are ever returned — this is what
// keeps the emergency request form fraud-resistant.
router.get("/", (req, res) => {
  const { type } = req.query;
  const list = facilities.filter((f) => f.verified && (!type || f.type === type));
  res.json(list);
});

export default router;
