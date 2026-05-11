/** Maximum number of devices allowed per account. */
const MAX_DEVICES_PER_ACCOUNT = 2

export async function getDeviceId(): Promise<string> {
  if (window.electronAPI) {
    return window.electronAPI.getDeviceId()
  }
  // Browser/dev fallback: use crypto.randomUUID() for a stable per-session ID
  // (In production this path is never hit — Electron always provides getDeviceId)
  return 'dev-' + crypto.randomUUID()
}

export async function registerDevice(userId: string): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await import('./supabase') // dynamic import avoids circular dep with supabase.ts
  const deviceId = await getDeviceId()

  const { data, error } = await supabase
    .from('users_meta')
    .select('device_ids')
    .eq('id', userId)
    .single()

  if (error) return { success: false, error: error.message }

  const deviceIds: string[] = data?.device_ids ?? []

  if (deviceIds.includes(deviceId)) {
    return { success: true }
  }

  if (deviceIds.length >= MAX_DEVICES_PER_ACCOUNT) {
    return { success: false, error: 'Max devices reached. Remove a device in settings.' }
  }

  const { error: updateError } = await supabase
    .from('users_meta')
    .update({ device_ids: [...deviceIds, deviceId] })
    .eq('id', userId)

  if (updateError) return { success: false, error: updateError.message }
  return { success: true }
}
