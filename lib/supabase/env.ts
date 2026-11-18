export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const allowedEmail = process.env.ALLOWED_EMAIL?.toLowerCase();

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey && allowedEmail);

export function isAllowed(email: string | undefined | null) {
  return Boolean(email && allowedEmail && email.toLowerCase() === allowedEmail);
}
