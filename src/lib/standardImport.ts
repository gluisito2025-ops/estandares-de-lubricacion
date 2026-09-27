import * as XLSX from 'xlsx'
import { tonelloMachine, type LubricationPoint } from '../data/tonello'
import type { MachineRecord } from '../data/machines'
import { compressImage } from './imageResize'
import { deleteImages, putImage } from './imageStore'
import { extractWorkbookMedia, findHeadersRow, type MediaCandidate } from './workbookImages'

export type ImportResult = {
  machine: MachineRecord
  pointsCount: number
  machinePhotos: number
  pointPhotos: number
}

export class ImportError extends Error {}

function cell(row: unknown[], index: number): string {
  return String(row?.[index] ?? '').trim()
}

function cleanMultiline(value: string): string {
  return value.replace(/\r\n|\r|\n/g, ' · ').replace(/\s*·\s*·\s*/g, ' · ').replace(/\s{2,}/g, ' ').trim()
}

function findMachineField(rows: unknown[][], label: string): string {
  for (const row of rows.slice(0, 12)) {
    const index = row.findIndex((value) => String(value ?? '').trim().toLowerCase().startsWith(label.toLowerCase()))
    if (index !== -1 && row[index + 1] !== null && row[index + 1] !== undefined) return cell(row, index + 1)
  }
  return ''
}

function toDataUrl(candidate: MediaCandidate): Promise<string> {
  return compressImage(new Blob([candidate.bytes as BlobPart], { type: candidate.mime }), 1600)
}

async function mapWithLimit<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

export async function importStandardFile(file: File, existing: MachineRecord[]): Promise<ImportResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', bookFiles: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new ImportError('El archivo no contiene hojas de cálculo.')

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, blankrows: true })
  const headersIndex = findHeadersRow(rows)
  if (headersIndex === -1) throw new ImportError('No se encontró la tabla de puntos de lubricación en el archivo.')

  const pointRows = rows.slice(headersIndex + 1).filter((row) => typeof row?.[0] === 'number')
  if (!pointRows.length) throw new ImportError('No se encontraron puntos de lubricación en el archivo.')

  const name = findMachineField(rows, 'Nombre de m') || file.name.replace(/\.[^.]+$/, '')
  const media = await extractWorkbookMedia(buffer, rows, sheetName)

  const previous = existing.find((item) => item.sourceFile === file.name && item.name === name)
  const machineId = previous?.id ?? crypto.randomUUID()
  const token = `${machineId.slice(0, 8)}-${Date.now().toString(36)}`

  const machinePhotoIds = await mapWithLimit(media.machinePhotos.slice(0, 6), 3, async (candidate, index) => {
    const id = `maquina:${token}:${index}`
    await putImage(id, await toDataUrl(candidate))
    return id
  })

  const points: LubricationPoint[] = await mapWithLimit(pointRows, 2, async (row, index) => {
    const pointNumber = Number(row[0])
    const photos = await mapWithLimit(media.pointPhotos.get(pointNumber) ?? [], 3, async (candidate, photoIndex) => {
      const id = `punto:${token}:${pointNumber}:${photoIndex}`
      await putImage(id, await toDataUrl(candidate))
      return id
    })
    return {
      id: pointNumber,
      photos,
      component: cell(row, 2),
      reference: cell(row, 3),
      lubricant: cleanMultiline(cell(row, 4)),
      procedure: cleanMultiline(cell(row, 5)),
      tools: cell(row, 6) || 'No especificada en el estándar',
      code: cell(row, 7),
      quantity: cell(row, 8),
      frequency: cell(row, 9),
      time: row[10] === null || row[10] === undefined || row[10] === '' ? 'No especificado' : `${row[10]} min`,
      x: 20 + ((index * 23) % 65),
      y: 25 + ((index * 19) % 55),
    }
  })

  if (previous) {
    const stale = [previous.photoId, ...previous.photoIds, ...previous.points.flatMap((item) => item.photos ?? [])]
    await deleteImages(stale.filter((id): id is string => Boolean(id)))
  }

  const machine: MachineRecord = {
    id: machineId,
    name,
    model: findMachineField(rows, 'Modelo') || '',
    series: findMachineField(rows, 'Serie') || '',
    plant: findMachineField(rows, 'Planta') || '',
    sourceFile: file.name,
    photoId: machinePhotoIds[0],
    photoIds: machinePhotoIds,
    importedAt: Date.now(),
    points,
  }

  return {
    machine,
    pointsCount: points.length,
    machinePhotos: machinePhotoIds.length,
    pointPhotos: points.reduce((total, point) => total + point.photos.length, 0),
  }
}

export function seedMachine(): MachineRecord {
  return {
    id: 'tonello-g1-510-md2',
    name: tonelloMachine.name,
    model: tonelloMachine.model,
    series: tonelloMachine.series,
    plant: tonelloMachine.plant,
    sourceFile: tonelloMachine.sourceFile,
    photoId: undefined,
    photoIds: [],
    importedAt: Date.now(),
    points: tonelloMachine.points.map((point) => ({ ...point, photos: [] })),
  }
}
