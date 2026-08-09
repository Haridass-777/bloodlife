import { supabase } from "../lib/supabase";

function generateUserCode(role) {
  const prefix = { hospital: "HOSP", clinic: "CLN", bloodbank: "BB", donor: "DNR" }[role] || "USR";
  const rand = Math.floor(1000 + Math.random() * 9000); // 4-digit
  return `${prefix}-${rand}`;
}

export async function login(role, email, password) {
    
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authError) throw new Error(authError.message);

  const { data: user, error: profileError } = await supabase
    .from("user_accounts")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !user) {
    await supabase.auth.signOut();
    throw new Error("User profile not found.");
  }

  if (user.role !== role) {
    await supabase.auth.signOut();
    throw new Error(`This account is registered as '${user.role}', not '${role}'.`);
  }

  if (user.account_status !== "active") {
    await supabase.auth.signOut();
    throw new Error(`Account status: ${user.account_status}. Please contact the administrator.`);
  }

  await supabase
    .from("user_accounts")
    .update({ last_login: new Date().toISOString() })
    .eq("id", user.id);

  return user;
}

export async function signup({ fullName, email, mobile, password }) {
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  if (authError) throw new Error(authError.message);

  // If email confirmation is required, authData.session/user may be limited.
  if (!authData.user) {
    throw new Error("Signup started — check your email to confirm your account before logging in.");
  }

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

  if (profileError) throw new Error(profileError.message);

  return profile;
}