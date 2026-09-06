import { supabase } from "../lib/supabase";

function generateUserCode(role) {
  const prefix = { hospital: "HOSP", bloodbank: "BB", donor: "DNR" }[role] || "USR";
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${rand}`;
}

// ============================================
// LOGIN - Verify role matches account
// ============================================
export async function login(role, email, password) {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authError) throw new Error(authError.message);
  if (!authData.user) throw new Error("Login failed. Please try again.");

  // Fetch user profile from database
  const { data: user, error: profileError } = await supabase
    .from("user_accounts")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !user) {
    await supabase.auth.signOut();
    throw new Error("User profile not found in database.");
  }

  // Verify role matches what they're trying to log into
  if (user.role !== role) {
    await supabase.auth.signOut();
    throw new Error(
      `This account is registered as '${user.role}', not '${role}'. Please log in to the correct portal.`
    );
  }

  // Check account status
  if (user.account_status !== "active") {
    await supabase.auth.signOut();
    throw new Error(`Account status: ${user.account_status}. Contact your administrator.`);
  }

  // Update last login timestamp
  await supabase
    .from("user_accounts")
    .update({ last_login: new Date().toISOString() })
    .eq("id", user.id);

  return user;
}

// ============================================
// SIGNUP - New donor registration
// ============================================
export async function signup({ fullName, email, mobile, password }) {
  // Step 1: Create Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) throw new Error(authError.message);
  if (!authData.user) {
    throw new Error("Signup started — check your email to confirm account before logging in.");
  }

  // Step 2: Create user profile in user_accounts
  const { data: profile, error: profileError } = await supabase
    .from("user_accounts")
    .insert({
      id: authData.user.id,
      user_code: generateUserCode("donor"),
      role: "donor",
      full_name: fullName,
      email,
      mobile,
      account_status: "active",
      email_verified: false,
      mobile_verified: false,
    })
    .select()
    .single();

  if (profileError) {
    // Clean up auth user if profile creation fails
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw new Error(`Profile creation failed: ${profileError.message}`);
  }

  return profile;
}

// ============================================
// LOGOUT - Sign out current user
// ============================================
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

// ============================================
// GET CURRENT USER - Fetch session user
// ============================================
export async function getCurrentUser() {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: user, error } = await supabase
    .from("user_accounts")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (error) return null;
  return user;
}

// ============================================
// VERIFY EMAIL - Mark email as verified
// ============================================
export async function verifyEmail(userId) {
  const { data, error } = await supabase
    .from("user_accounts")
    .update({ 
      email_verified: true,
      email_verified_at: new Date().toISOString()
    })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// ============================================
// VERIFY MOBILE - Mark mobile as verified
// ============================================
export async function verifyMobile(userId) {
  const { data, error } = await supabase
    .from("user_accounts")
    .update({ 
      mobile_verified: true,
      mobile_verified_at: new Date().toISOString()
    })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}