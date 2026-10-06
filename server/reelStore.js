import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const recordsPath = path.join(root, 'data/reel-records.json')

const readRecords = async () => {
  try {
    return JSON.parse(await readFile(recordsPath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

export const saveReelRecord = async (record) => {
  const records = await readRecords()
  const next = [record, ...records.filter((item) => item.id !== record.id)].slice(0, 100)
  await mkdir(path.dirname(recordsPath), { recursive: true })
  const tempPath = `${recordsPath}.${randomUUID()}.tmp`
  await writeFile(tempPath, JSON.stringify(next, null, 2), 'utf8')
  await rename(tempPath, recordsPath)
}

export const getReelRecord = async (id) => (await readRecords()).find((record) => record.id === id) ?? null

export const listReelRecords = async () => readRecords()