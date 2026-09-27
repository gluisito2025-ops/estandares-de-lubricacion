const MACHINE_MAX_DIMENSION = 1600
const POINT_MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.82

async function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function loadBitmap(blob: Blob): Promise<{ width: number; height: number; draw: CanvasImageSource; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
    return { width: bitmap.width, height: bitmap.height, draw: bitmap, release: () => bitmap.close() }
  }
  const dataUrl = await readAsDataUrl(blob)
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('No se pudo decodificar la imagen'))
    element.src = dataUrl
  })
  return { width: image.naturalWidth, height: image.naturalHeight, draw: image, release: () => {} }
}

export async function compressImage(blob: Blob, maxDimension: number): Promise<string> {
  const { width, height, draw, release } = await loadBitmap(blob)
  try {
    const scale = Math.min(1, maxDimension / Math.max(width, height))
    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const context = canvas.getContext('2d')
    if (!context) return await readAsDataUrl(blob)
    context.drawImage(draw, 0, 0, targetWidth, targetHeight)
    const encoded = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    return encoded.length > 240 ? encoded : await readAsDataUrl(blob)
  } finally {
    release()
  }
}

export async function fileToDataUrl(file: File, maxDimension = POINT_MAX_DIMENSION): Promise<string> {
  return compressImage(file, maxDimension)
}

export function machinePhotoFrom(file: File): Promise<string> {
  return compressImage(file, MACHINE_MAX_DIMENSION)
}

export function pointPhotoFrom(file: File): Promise<string> {
  return compressImage(file, POINT_MAX_DIMENSION)
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, payload] = dataUrl.split(',')
  const mime = /:(.*?);/.exec(header)?.[1] ?? 'image/jpeg'
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mime })
}
