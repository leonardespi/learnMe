import zodToJsonSchema from 'zod-to-json-schema'
import { AnkiDeckSchema } from '../src/schemas/anki-deck.ts'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const schema = zodToJsonSchema(AnkiDeckSchema)
const outPath = resolve(__dirname, '../schemas/anki-deck.v1.json')
writeFileSync(outPath, JSON.stringify(schema, null, 2) + '\n')
console.log('Generated', outPath)
