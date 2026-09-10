import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./LandingPage";
import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";
import DonorPage from "./DonorPage";
import ContactUsPage from "./ContactUsPage";
import Hospital from "./Hospital";
import EmergencyRequestPage from "./EmergencyRequestPage";
import Quick from "./Quick";
import "./App.css";
 import BloodBank from "./BloodBank";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/donor" element={<DonorPage />} />
        <Route path="/contact" element={<ContactUsPage />} />
        <Route path="/hospital" element={<Hospital />} />
        <Route path="/emergency-request" element={<EmergencyRequestPage />} />
        <Route path="/quick-search/:requestId" element={<Quick />} />
        <Route path="/bloodbank" element={<BloodBank />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}