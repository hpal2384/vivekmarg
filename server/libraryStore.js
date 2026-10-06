import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const libraryPath = path.join(root, 'data/library.json')

const readLibrary = async () => {
  try {
    const raw = await readFile(libraryPath, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

export const listLibraryMomentIds = async () => readLibrary()

export const saveLibraryMomentIds = async (ids) => {
  const normalized = Array.from(new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string' && id.length > 0)))
  await mkdir(path.dirname(libraryPath), { recursive: true })
  const tempPath = `${libraryPath}.${randomUUID()}.tmp`
  await writeFile(tempPath, JSON.stringify(normalized, null, 2), 'utf8')
  await rename(tempPath, libraryPath)
  return normalized
}
