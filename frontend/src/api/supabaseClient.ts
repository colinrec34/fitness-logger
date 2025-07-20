import { createClient } from '@supabase/supabase-js';
import type { User, Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function getUser(): Promise<User | null> {
  try {
    const res = await fetch('https://rcdkucjsapmykzkiodzu.supabase.co/functions/v1/get-user', {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const { user } = await res.json();
    return user;
  } catch (err) {
    console.error('Unexpected error getting user from cookie:', err);
    return null;
  }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const access_token = data.session?.access_token;
  const refresh_token = data.session?.refresh_token;

  console.log("Tokens:", { access_token, refresh_token }); // 👈 ADD THIS

  if (access_token && refresh_token) {
    await fetch('https://rcdkucjsapmykzkiodzu.supabase.co/functions/v1/set-auth-cookie', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'x-refresh-token': refresh_token,
      },
      credentials: 'include',
    });
  }

  return data.user;
}



export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}
