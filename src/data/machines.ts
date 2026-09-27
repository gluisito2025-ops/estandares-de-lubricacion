import type { LubricationPoint } from './tonello'

export type MachineRecord = {
  id: string
  name: string
  model: string
  series: string
  plant: string
  sourceFile: string
  photoId?: string
  photoIds: string[]
  importedAt: number
  points: LubricationPoint[]
}

export const machinesStorageKey = 'estandares-lubricacion:machines'
export const activeMachineStorageKey = 'estandares-lubricacion:active-machine'
export const legacyStandardKey = 'estandares-lubricacion:tonello-standard'

export function loadMachines(): MachineRecord[] {
  try {
    const saved = localStorage.getItem(machinesStorageKey)
    if (!saved) return []
    const parsed = JSON.parse(saved) as MachineRecord[]
    return Array.isArray(parsed) ? parsed.filter((item) => item && Array.isArray(item.points)) : []
  } catch {
    return []
  }
}

export function saveMachines(machines: MachineRecord[]): void {
  localStorage.setItem(machinesStorageKey, JSON.stringify(machines))
}

export function getActiveMachineId(): string | null {
  return localStorage.getItem(activeMachineStorageKey)
}

export function setActiveMachineId(id: string | null): void {
  if (id) localStorage.setItem(activeMachineStorageKey, id)
  else localStorage.removeItem(activeMachineStorageKey)
}

export function readLegacyStandard(): { id?: string; machine: Omit<MachineRecord, 'id' | 'photoIds' | 'importedAt' | 'points'>; points: LubricationPoint[] } | null {
  try {
    const saved = localStorage.getItem(legacyStandardKey)
    if (!saved) return null
    const parsed = JSON.parse(saved) as { machine?: MachineRecord; points?: LubricationPoint[] }
    if (!parsed?.machine || !Array.isArray(parsed.points)) return null
    const { id, name, model, series, plant, sourceFile } = parsed.machine
    return { id, machine: { name, model, series, plant, sourceFile }, points: parsed.points }
  } catch {
    return null
  }
}

export function machineInitials(name: string): string {
  return name
    .replace(/\b(LAVADORA|MAQUINA|MÁQUINA|MARCA|DE|del)\b/gi, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase() || 'MA'
}

export function machinePhotoIds(machine: MachineRecord): string[] {
  return Array.from(new Set([machine.photoId, ...machine.photoIds].filter((id): id is string => Boolean(id))))
}

export function machinePointPhotoIds(machine: MachineRecord): string[] {
  return machine.points.flatMap((point) => point.photos ?? [])
}
