#!/usr/bin/env node
// Скачивает официальные курсы НБ РК и раскладывает по папкам год/месяц/день.
//   node scripts/fetch-rates.mjs                  — сегодня (Алматы) + догонка пропущенных дней за последние 7
//   FROM=2024-01-01 node scripts/fetch-rates.mjs  — бэкфилл с указанной даты до сегодня
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  addDays, almatyToday, buildRecord, datesBetween, filePath, isIsoDate, nbkUrl, parseNbkXml, sameRates,
} from './nbk.mjs'

const CATCH_UP_DAYS = 7
const DELAY_MS = 250
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return undefined
  }
}

async function fetchDay(date) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(nbkUrl(date), { signal: AbortSignal.timeout(20_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return parseNbkXml(await res.text())
    } catch (e) {
      console.warn(`[${date}] попытка ${attempt}/3: ${e.message}`)
      if (attempt < 3) await sleep(2000 * attempt)
    }
  }
  throw new Error(`не удалось получить курсы за ${date}`)
}

const today = almatyToday()
const from = process.env.FROM?.trim()
if (from && (!isIsoDate(from) || from > today)) {
  console.error(`FROM должен быть датой YYYY-MM-DD не позже ${today}`)
  process.exit(2)
}
const start = from || addDays(today, -CATCH_UP_DAYS)

let written = 0
let latest
let todayOk = false
for (const date of datesBetween(start, today)) {
  const path = filePath(date)
  const existing = await readJson(path)
  // Прошедшие дни неизменны; сегодняшний пересверяем (Нацбанк мог обновить значение).
  if (existing && date !== today) {
    latest = existing
    continue
  }
  let parsed
  try {
    parsed = await fetchDay(date)
    await sleep(DELAY_MS)
  } catch (e) {
    console.error(e.message)
    continue
  }
  if (!parsed) {
    console.warn(`[${date}] курсы ещё не опубликованы`)
    continue
  }
  if (existing && sameRates(existing.rates, parsed.rates)) {
    latest = existing
  } else {
    latest = buildRecord(parsed)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(latest, null, 2) + '\n')
    written++
    console.log(`[${date}] записано: ${path} (${Object.keys(parsed.rates).length} валют)`)
  }
  if (date === today) todayOk = true
}

if (latest) await writeFile('latest.json', JSON.stringify(latest, null, 2) + '\n')
console.log(`Готово: записано файлов — ${written}, актуальная дата — ${latest?.date ?? 'нет'}`)
if (!todayOk) {
  console.error(`Курсы за ${today} получить не удалось`)
  process.exit(1)
}
