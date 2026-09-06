import { supabase } from "../lib/supabase";

// ============================================
// HELPER: Generate donor code
// ============================================
function generateDonorCode() {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DNR-${rand}`;
}

// ============================================
// HELPER: Calculate donor eligibility
// ============================================
function calculateDonorEligibility(formData) {
  if (formData.hemoglobinOk === "no") {
    return {
      level: "block",
      reason: "Low hemoglobin — please address this first.",
    };
  }

  if (formData.weightOver50 === "no") {
    return {
      level: "block",
      reason: "Minimum weight for donation is 50 kg.",
    };
  }

  if ((formData.chronic || []).length > 0) {
    return {
      level: "block",
      reason: `Cannot donate with: ${formData.chronic.join(", ")}`,
    };
  }

  if (formData.smoker === "yes" || formData.alcohol === "yes") {
    return {
      level: "caution",
      reason: "Smoker/alcohol use noted — staff will review during intake.",
    };
  }

  return {
    level: "ok",
    reason: "Eligible to donate",
  };
}

// ============================================
// REGISTER DONOR - Full signup flow
// ============================================
export async function registerDonor(formData) {
  // Step 1: Create Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
  });

  if (authError) throw new Error(authError.message);
  if (!authData.user) {
    throw new Error("Check your email to confirm account.");
  }

  const userId = authData.user.id;

  // Step 2: Create user account
  const { data: account, error: accountError } = await supabase
    .from("user_accounts")
    .insert({
      id: userId,
      user_code: generateDonorCode(),
      role: "donor",
      full_name: formData.fullName,
      email: formData.email,
      mobile: formData.phone,
      account_status: "active",
      email_verified: false,
      mobile_verified: false,
    })
    .select()
    .single();

  if (accountError) throw new Error(accountError.message);

  // Step 3: Calculate eligibility
  const eligibility = calculateDonorEligibility(formData);

  // Step 4: Create donor profile
  const { data: profile, error: profileError } = await supabase
    .from("donor_profiles")
    .insert({
      user_id: userId,
      blood_group: formData.bloodGroup,
      gender: formData.gender,
      dob: formData.dob,
      weight_over_50: formData.weightOver50 === "yes",
      hemoglobin_ok: formData.hemoglobinOk === "yes",
      is_smoker: formData.smoker === "yes",
      consumes_alcohol: formData.alcohol === "yes",
      alcohol_frequency: formData.alcoholFreq || null,
      chronic_conditions: formData.chronic || [],
      last_donation_date: formData.lastDonation || null,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      latitude: formData.lat ? parseFloat(formData.lat) : null,
      longitude: formData.lng ? parseFloat(formData.lng) : null,
      aadhaar_number: formData.aadhaar || null,
      eligibility_level: eligibility.level,
      eligibility_reason: eligibility.reason,
      available: eligibility.level === "ok" || eligibility.level === "caution",
      is_verified: false,
    })
    .select()
    .single();

  if (profileError) {
    // Cleanup auth if profile fails
    await supabase.auth.admin.deleteUser(userId);
    throw new Error(profileError.message);
  }

  return {
    id: profile.id,
    userId,
    fullName: account.full_name,
    email: account.email,
    phone: account.mobile,
    bloodGroup: profile.blood_group,
    city: profile.city,
    eligibility,
  };
}

// ============================================
// GET DONOR PROFILE - Full profile for logged-in donor
// ============================================
export async function getDonorProfile(userId) {
  const { data: account, error: accountError } = await supabase
    .from("user_accounts")
    .select("*")
    .eq("id", userId)
    .single();

  if (accountError) throw new Error(accountError.message);

  const { data: profile, error: profileError } = await supabase
    .from("donor_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (profileError) throw new Error(profileError.message);

  return {
    id: profile.id,
    userId,
    fullName: account.full_name,
    email: account.email,
    phone: account.mobile,
    gender: profile.gender,
    dob: profile.dob,
    bloodGroup: profile.blood_group,
    address: profile.address,
    city: profile.city,
    state: profile.state,
    pincode: profile.pincode,
    lastDonation: profile.last_donation_date,
    available: profile.available,
    verified: profile.is_verified,
    eligibility: {
      level: profile.eligibility_level || "ok",
      reason: profile.eligibility_reason || "",
    },
  };
}

// ============================================
// UPDATE DONOR PROFILE
// ============================================
export async function updateDonorProfile(donorProfileId, updates) {
  const allowed = [
    "phone",
    "address",
    "city",
    "state",
    "pincode",
    "latitude",
    "longitude",
    "chronic_conditions",
    "alcohol_frequency",
    "last_donation_date",
  ];

  const payload = {};
  for (const key of allowed) {
    if (key in updates) {
      payload[key] = updates[key];
    }
  }
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("donor_profiles")
    .update(payload)
    .eq("id", donorProfileId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// UPDATE DONOR AVAILABILITY
// ============================================
export async function updateDonorAvailability(donorProfileId, available) {
  const { data, error } = await supabase
    .from("donor_profiles")
    .update({
      available,
      updated_at: new Date().toISOString(),
    })
    .eq("id", donorProfileId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// GET AVAILABLE DONORS - By blood group
// ============================================
export async function getAvailableDonors(bloodGroup, lat = null, lng = null, radiusKm = 50) {
  let query = supabase
    .from("donor_profiles")
    .select("*, user_accounts(full_name, mobile, email)")
    .eq("available", true)
    .eq("eligibility_level", "ok");

  // Get universal donors too (O-)
  if (bloodGroup !== "O-") {
    query = query.or(`blood_group.eq.${bloodGroup},blood_group.eq.O-`);
  } else {
    query = query.eq("blood_group", "O-");
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);

  // Filter by distance if coordinates provided
  if (lat && lng) {
    return (data || [])
      .map((d) => ({
        ...d,
        distanceKm: calculateDistance(lat, lng, d.latitude, d.longitude),
      }))
      .filter((d) => d.distanceKm && d.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  return data || [];
}

// ============================================
// MARK DONATION COMPLETED
// ============================================
export async function recordDonation(donorProfileId) {
  const { data, error } = await supabase
    .from("donor_profiles")
    .update({
      last_donation_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", donorProfileId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// GET DONOR HISTORY - Request responses
// ============================================
export async function getDonorRequestHistory(donorId) {
  const { data, error } = await supabase
    .from("donor_requests")
    .select("*, emergency_requests(blood_group, patient_name, priority)")
    .eq("donor_id", donorId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// SEARCH DONORS - By city/blood group
// ============================================
export async function searchDonors(bloodGroup, city = null) {
  let query = supabase
    .from("donor_profiles")
    .select("id, user_accounts(full_name), blood_group, city, available, eligibility_level")
    .eq("available", true);

  if (city) {
    query = query.eq("city", city);
  }

  if (bloodGroup !== "all") {
    query = query.or(`blood_group.eq.${bloodGroup},blood_group.eq.O-`);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// HELPER: Calculate distance
// ============================================
function calculateDistance(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;

  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}