import { createClient } from '@supabase/supabase-js'

const projectUrl = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!projectUrl || !publishableKey)
  throw new Error('Missing Supabase environment variables.')

export const supabase = createClient(projectUrl, publishableKey)

export async function ensureSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) throw error
  if (session) return session

  const { data, error: signInError } = await supabase.auth.signInAnonymously()
  if (signInError) throw signInError
  return data.session
}
