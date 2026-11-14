// Turns the Gujarati tour scripts in features/tour/tours/*.json into voice clips with Sarvam (Bulbul), once.
// Only steps whose text changed are sent again, so edits cost a few paise. The key is read from SARVAM_API_KEY and never saved here.
//   SARVAM_API_KEY=... node scripts/make-tour-audio.mjs [tourName]
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const VOICE = { model: 'bulbul:v3', speaker: process.env.TOUR_SPEAKER || 'shubh', pace: 0.95 }
// Keys in order: when one runs out of credit, the next is used.
const keys = [process.env.SARVAM_API_KEY, process.env.SARVAM_API_KEY_2].map(value => value?.trim()).filter(Boolean)
if (keys.length === 0) { console.error('Set SARVAM_API_KEY first.'); process.exit(1) }
let keyIndex = 0

const toursDir = 'features/tour/tours'
const only = process.argv[2]
for (const file of readdirSync(toursDir).filter(name => name.endsWith('.json'))) {
  const name = file.replace(/\.json$/, '')
  if (only && only !== name) continue
  const tour = JSON.parse(readFileSync(join(toursDir, file), 'utf8'))
  const outDir = join('public', 'tours', name)
  mkdirSync(outDir, { recursive: true })
  const index = {}
  for (const step of tour.steps) {
    // A tour may tune the voice (for example a livelier, more natural delivery); older tours keep the default and their clips.
    const voice = { ...VOICE, ...(tour.voice ?? {}) }
    const hash = createHash('sha1').update(JSON.stringify([step.text, voice])).digest('hex').slice(0, 8)
    const clip = `${step.id}-${hash}.mp3`
    index[step.id] = clip
    if (existsSync(join(outDir, clip))) { console.log(`${name}/${step.id}: unchanged`); continue }
    const ask = () => fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'api-subscription-key': keys[keyIndex], 'content-type': 'application/json' },
      body: JSON.stringify({ text: step.text, language_code: 'gu-IN', ...voice, output_audio_codec: 'mp3', speech_sample_rate: 24000 }),
    })
    let response = await ask()
    while (!response.ok && [401, 402, 403, 429].includes(response.status) && keyIndex + 1 < keys.length) { keyIndex += 1; console.log(`switching to key ${keyIndex + 1}`); response = await ask() }
    if (!response.ok) { console.error(`${name}/${step.id}: Sarvam answered ${response.status} ${(await response.text()).slice(0, 200)}`); process.exit(1) }
    const body = await response.json()
    writeFileSync(join(outDir, clip), Buffer.from(body.audios[0], 'base64'))
    // Speech stays clear at 48 kbps mono and the file is about 2.6 times smaller. Skipped when ffmpeg is not installed.
    try {
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(outDir, clip), '-ac', '1', '-ar', '24000', '-b:a', '48k', join(outDir, `${clip}.tmp.mp3`)])
      renameSync(join(outDir, `${clip}.tmp.mp3`), join(outDir, clip))
    } catch { /* keep the original clip */ }
    console.log(`${name}/${step.id}: made (${step.text.length} characters)`)
  }
  // Remove clips of older versions of the text.
  const keep = new Set(Object.values(index))
  for (const old of readdirSync(outDir).filter(item => item.endsWith('.mp3') && !keep.has(item))) unlinkSync(join(outDir, old))
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(index, null, 2) + '\n')
}
