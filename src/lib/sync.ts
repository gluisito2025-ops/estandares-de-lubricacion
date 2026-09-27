import { isCloudSyncEnabled, supabase } from './supabase'

export const cloudSyncKeys = [
  'estandares-lubricacion:users',
  'estandares-lubricacion:machines',
]

export async function pullFromCloud(): Promise<void> {
  if (!isCloudSyncEnabled) return
  const { data, error } = await supabase!.from('app_data').select('clave, valor').in('clave', cloudSyncKeys)
  if (error || !data) return
  for (const row of data) {
    if (row.valor) localStorage.setItem(row.clave, String(row.valor))
  }
}

export async function pushToCloud(key: string, value: string): Promise<void> {
  localStorage.setItem(key, value)
  if (!isCloudSyncEnabled) return
  await supabase!.from('app_data').upsert({ clave: key, valor: value }, { onConflict: 'clave' })
}