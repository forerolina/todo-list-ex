import { createClient } from '@supabase/supabase-js'

const projectUrl = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!projectUrl || !publishableKey)
  throw new Error('Missing Supabase environment variables.')

export const supabase = createClient(projectUrl, publishableKey)

export async function getSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) throw error
  return session
}

export async function ensureSession() {
  const session = await getSession()
  if (session) return session

  const { data, error: signInError } = await supabase.auth.signInAnonymously()
  if (signInError) throw signInError
  return data.session
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}

export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) throw error
  return data
}

export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

export async function signInWithMagicLink(email) {
  const redirectTo = window.location.origin
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  })

  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/** True when the URL likely contains tokens from an email link (recovery, magic link, PKCE). */
export function hasAuthCallbackInUrl() {
  const { hash, search } = window.location
  const h = hash.slice(1)
  const paramsFromHash = new URLSearchParams(h)
  if (paramsFromHash.get('type') === 'recovery') return true
  if (hash.includes('access_token')) return true
  if (search.includes('code=')) return true
  return false
}

export async function requestPasswordReset(email) {
  const redirectTo = window.location.origin
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  })

  if (error) throw error
}

export async function updateAccountPassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) throw error
  return data
}

export async function linkAnonymousToEmailPassword(email, password) {
  const session = await getSession()
  const currentUser = session?.user
  if (!currentUser?.is_anonymous)
    throw new Error('Anonymous session is required to link account.')

  const { data, error } = await supabase.auth.updateUser({
    email,
    password,
  })

  if (error) throw error
  return data
}
