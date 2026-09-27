import * as XLSX from 'xlsx'

export type MediaCandidate = {
  entryName: string
  mime: string
  bytes: Uint8Array
  width: number
  height: number
  area: number
}

export type WorkbookMedia = {
  machinePhotos: MediaCandidate[]
  pointPhotos: Map<number, MediaCandidate[]>
  totalImages: number
}

type ZipEntry = { name: string; content: Uint8Array; size: number }

const MIME_BY_EXTENSION: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
}

function readEntries(files: Record<string, unknown>): Map<string, ZipEntry> {
  const entries = new Map<string, ZipEntry>()
  for (const [name, value] of Object.entries(files ?? {})) {
    const entry = value as ZipEntry
    if (entry && entry.content) entries.set(name.replace(/^\/?xl\//, 'xl/').replace(/\\/g, '/'), entry)
  }
  return entries
}

function textOf(entries: Map<string, ZipEntry>, path: string): string {
  const entry = entries.get(path)
  return entry ? new TextDecoder().decode(entry.content) : ''
}

function bytesOf(entries: Map<string, ZipEntry>, path: string): Uint8Array | null {
  return entries.get(path)?.content ?? null
}

function resolvePath(base: string, target: string): string {
  const stack = base.split('/').slice(0, -1)
  for (const segment of target.replace(/^\//, '').split('/')) {
    if (segment === '.' || segment === '') continue
    if (segment === '..') stack.pop()
    else stack.push(segment)
  }
  return stack.join('/')
}

function relationshipTargets(xml: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const match of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /Id="([^"]+)"/.exec(match[0])?.[1]
    const target = /Target="([^"]+)"/.exec(match[0])?.[1]
    if (id && target) map.set(id, target)
  }
  return map
}

export function readImageSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue }
      const marker = bytes[offset + 1]
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: view.getUint16(offset + 5, false), width: view.getUint16(offset + 7, false) }
      }
      offset += 2 + view.getUint16(offset + 2, false)
    }
    return { width: 0, height: 0 }
  }
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { width: view.getUint32(16, false), height: view.getUint32(20, false) }
  }
  if (bytes.length > 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) }
  }
  return { width: 0, height: 0 }
}

const ANCHOR_TAGS = ['<xdr:oneCellAnchor', '<xdr:twoCellAnchor']

function eachAnchor(xml: string, visit: (block: string) => void): void {
  for (const tag of ANCHOR_TAGS) {
    let start = xml.indexOf(tag)
    while (start !== -1) {
      const next = xml.indexOf(tag, start + 1)
      visit(xml.slice(start, next === -1 ? xml.length : next))
      start = next
    }
  }
}

function anchorBounds(block: string): { fromRow: number; fromCol: number; toRow: number } | null {
  const from = /<xdr:from>[\s\S]*?<\/xdr:from>/.exec(block)?.[0]
  if (!from) return null
  const fromRow = Number(/<xdr:row>(\d+)<\/xdr:row>/.exec(from)?.[1])
  const fromCol = Number(/<xdr:col>(\d+)<\/xdr:col>/.exec(from)?.[1])
  const to = /<xdr:to>[\s\S]*?<\/xdr:to>/.exec(block)?.[0]
  const toRow = to ? Number(/<xdr:row>(\d+)<\/xdr:row>/.exec(to)?.[1]) : fromRow
  if (!Number.isFinite(fromRow)) return null
  return { fromRow, fromCol, toRow: Number.isFinite(toRow) ? toRow : fromRow }
}

export function findHeadersRow(rows: unknown[][]): number {
  const exact = rows.findIndex((row) => String(row?.[0] ?? '').trim().toLowerCase().replace(/^n[uú]mero/, 'numero') === 'numero punto de lubricacion')
  if (exact !== -1) return exact
  return rows.findIndex((row) => row?.some((cell) => /fotograf/i.test(String(cell ?? ''))))
}

export function findPhotoColumn(rows: unknown[][], headersIndex: number): number {
  const header = rows[headersIndex] ?? []
  const index = header.findIndex((cell) => /fotograf|imagen|foto/i.test(String(cell ?? '')))
  return index === -1 ? 1 : index
}

export function findDrawingPath(entries: Map<string, ZipEntry>, sheetName: string): string | null {
  const workbookXml = textOf(entries, 'xl/workbook.xml')
  const workbookRels = relationshipTargets(textOf(entries, 'xl/_rels/workbook.xml.rels'))
  const sheetTag = Array.from(workbookXml.matchAll(/<sheet\b[^>]*>/g))
    .map((match) => match[0])
    .find((tag) => (/name="([^"]*)"/.exec(tag)?.[1] ?? '') === sheetName)
  const relId = sheetTag ? /r:id="([^"]+)"/.exec(sheetTag)?.[1] : undefined
  const sheetTarget = relId ? workbookRels.get(relId) : undefined
  if (!sheetTarget) return null
  const sheetPath = resolvePath('xl/workbook.xml', sheetTarget)
  const sheetRels = relationshipTargets(textOf(entries, `xl/worksheets/_rels/${sheetPath.split('/').pop()}.rels`))
  for (const target of sheetRels.values()) {
    if (!target.includes('drawing')) continue
    const drawingPath = resolvePath(sheetPath, target)
    if (bytesOf(entries, drawingPath)) return drawingPath
  }
  return null
}

export async function extractWorkbookMedia(buffer: ArrayBuffer, rows: unknown[][], sheetName: string): Promise<WorkbookMedia> {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', bookFiles: true })
  const files = (workbook as unknown as { files?: Record<string, unknown> }).files
  const entries = readEntries(files ?? {})
  const drawingPath = findDrawingPath(entries, sheetName)
  const empty: WorkbookMedia = { machinePhotos: [], pointPhotos: new Map(), totalImages: 0 }
  if (!drawingPath) return empty

  const drawingXml = textOf(entries, drawingPath)
  const relsPath = drawingPath.replace(/([^/]+)$/, '_rels/$1.rels')
  const rels = relationshipTargets(textOf(entries, relsPath))
  const headersIndex = findHeadersRow(rows)
  const photoColumn = findPhotoColumn(rows, headersIndex)
  const pointNumbers = new Set<number>()
  for (let index = headersIndex + 1; index < rows.length; index += 1) {
    const value = rows[index]?.[0]
    if (typeof value === 'number') pointNumbers.add(value)
  }

  const cache = new Map<string, MediaCandidate | null>()
  const loadMedia = (relationshipId: string): MediaCandidate | null => {
    if (cache.has(relationshipId)) return cache.get(relationshipId) ?? null
    const target = rels.get(relationshipId)
    let candidate: MediaCandidate | null = null
    if (target) {
      const mediaPath = resolvePath(drawingPath, target)
      const bytes = bytesOf(entries, mediaPath)
      if (bytes?.length) {
        const extension = mediaPath.split('.').pop()?.toLowerCase() ?? 'jpeg'
        const { width, height } = readImageSize(bytes)
        candidate = { entryName: mediaPath, mime: MIME_BY_EXTENSION[extension] ?? 'image/jpeg', bytes, width, height, area: width * height }
      }
    }
    cache.set(relationshipId, candidate)
    return candidate
  }

  const machinePhotos: MediaCandidate[] = []
  const pointPhotos = new Map<number, MediaCandidate[]>()
  const anchors: { media: MediaCandidate; fromRow: number; toRow: number; fromCol: number }[] = []

  eachAnchor(drawingXml, (block) => {
    const relationshipId = /r:embed="([^"]+)"/.exec(block)?.[1]
    if (!relationshipId) return
    const bounds = anchorBounds(block)
    if (!bounds) return
    const media = loadMedia(relationshipId)
    if (!media) return
    anchors.push({ media, fromRow: bounds.fromRow, toRow: bounds.toRow, fromCol: bounds.fromCol })
  })

  const inTable = anchors.filter((anchor) => anchor.fromRow > headersIndex)
  const dataMedia = new Set(inTable.map((anchor) => anchor.media.entryName))
  const seenMachine = new Set<string>()

  for (const anchor of anchors) {
    if (anchor.fromRow > headersIndex) continue
    if (dataMedia.has(anchor.media.entryName)) continue
    if (seenMachine.has(anchor.media.entryName)) continue
    seenMachine.add(anchor.media.entryName)
    machinePhotos.push(anchor.media)
  }

  for (const anchor of inTable) {
    if (anchor.fromCol !== photoColumn) continue
    const rows_ = Array.from({ length: anchor.toRow - anchor.fromRow + 1 }, (_, offset) => anchor.fromRow + offset)
    const sharedWithOtherColumn = inTable.some((other) => other !== anchor && other.fromCol !== photoColumn && other.media.entryName === anchor.media.entryName && rows_.some((row) => row >= other.fromRow && row <= other.toRow))
    if (sharedWithOtherColumn) continue
    for (const row of rows_) {
      const pointNumber = row - headersIndex
      if (!pointNumbers.has(pointNumber)) continue
      const list = pointPhotos.get(pointNumber) ?? []
      if (!list.some((item) => item.entryName === anchor.media.entryName)) list.push(anchor.media)
      pointPhotos.set(pointNumber, list)
    }
  }

  machinePhotos.sort((a, b) => b.area - a.area)
  return { machinePhotos, pointPhotos, totalImages: cache.size }
}
