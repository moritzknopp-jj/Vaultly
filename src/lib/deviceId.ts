export async function getDeviceId(): Promise<string> {
  if (window.electronAPI) {
    return window.electronAPI.getDeviceId()
  }
  return 'dev-device-' + Math.random().toString(36).slice(2)
}

export async function registerDevice(userId: string): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await import('./supabase') // static imports cause circular issues here, dynamic is intentional
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

  if (deviceIds.length >= 2) {
    return { success: false, error: 'Max devices reached. Remove a device in settings.' }
  }

  const { error: updateError } = await supabase
    .from('users_meta')
    .update({ device_ids: [...deviceIds, deviceId] })
    .eq('id', userId)

  if (updateError) return { success: false, error: updateError.message }
  return { success: true }
}
