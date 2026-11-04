// Чистые функции без обращения к сети и диску — их покрывают тесты.

const pad = (n) => String(n).padStart(2, '0')

/** URL официального RSS Нацбанка РК на дату YYYY-MM-DD. */
export function nbkUrl(isoDate) {
  const [y, m, d] = isoDate.split('-')
  return `https://nationalbank.kz/rss/get_rates.cfm?fdate=${d}.${m}.${y}`
}

/** Относительный путь файла дня: 2026-11-04 → 2026/11/04-11-2026.json */
export function filePath(isoDate) {
  const [y, m, d] = isoDate.split('-')
  return `${y}/${m}/${d}-${m}-${y}.json`
}

export const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))

/** Сегодняшняя дата в Алматы (UTC+5) в формате YYYY-MM-DD. */
export function almatyToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(now)
}

export function addDays(isoDate, n) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** Все даты от from до to включительно. */
export function datesBetween(from, to) {
  const out = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

const round8 = (n) => Math.round(n * 1e8) / 1e8

/**
 * Разбирает XML Нацбанка. Возвращает { date, rates } или null, если курсов нет
 * (дата в будущем / ещё не опубликовано). rates — тенге за ОДНУ единицу валюты
 * (значение из XML делится на quant: например KRW публикуется за 100 вон).
 */
export function parseNbkXml(xml) {
  const dateMatch = /<date>\s*(\d{2})\.(\d{2})\.(\d{4})\s*<\/date>/.exec(xml)
  if (!dateMatch) return null
  const date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
  const rates = {}
  for (const item of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    const code = /<title>\s*([A-Z]{3})\s*<\/title>/.exec(item)?.[1]
    const value = Number(/<description>\s*([\d.,]+)\s*<\/description>/.exec(item)?.[1]?.replace(',', '.'))
    const quant = Number(/<quant>\s*(\d+)\s*<\/quant>/.exec(item)?.[1] ?? 1)
    if (code && Number.isFinite(value) && value > 0 && quant > 0) rates[code] = round8(value / quant)
  }
  return Object.keys(rates).length === 0 ? null : { date, rates }
}

export function buildRecord({ date, rates }, fetchedAt = new Date().toISOString()) {
  return { date, source: nbkUrl(date), fetchedAt, rates }
}

/** Равны ли наборы курсов (время получения не учитывается). */
export function sameRates(a, b) {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k])
}
