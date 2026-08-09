import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./LandingPage";
import DonorPage from "./DonorPage";
import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";
import ContactUsPage from "./ContactUsPage";
import EmergencyRequestPage from "./EmergencyRequestPage";
import Quick from "./Quick";
import Hospital from "./Hospital";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/donor" element={<DonorPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/contact-us" element={<ContactUsPage />} />
        <Route path="/emergency-request" element={<EmergencyRequestPage />} />
        <Route path="/quick-search" element={<Quick />} />
        <Route path="/facility" element={<Hospital />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
