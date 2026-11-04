import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addDays, almatyToday, buildRecord, datesBetween, filePath, isIsoDate, nbkUrl, parseNbkXml, sameRates,
} from '../scripts/nbk.mjs'

const item = (code, value, quant = 1) =>
  `<item><fullname>X</fullname><title>${code}</title><description>${value}</description><quant>${quant}</quant><index>DOWN</index></item>`
const xml = (date, items) => `<?xml version="1.0"?><rates><date>${date}</date>${items.join('')}</rates>`

test('filePath: год/месяц/день-месяц-год', () => {
  assert.equal(filePath('2026-11-04'), '2026/11/04-11-2026.json')
  assert.equal(filePath('2020-01-09'), '2020/01/09-01-2020.json')
})

test('nbkUrl использует формат ДД.ММ.ГГГГ', () => {
  assert.equal(nbkUrl('2026-11-04'), 'https://nationalbank.kz/rss/get_rates.cfm?fdate=04.11.2026')
})

test('parseNbkXml: курс за единицу, учитывает quant, запятую и дату', () => {
  const r = parseNbkXml(xml('04.11.2026', [item('USD', '453.26'), item('EUR', '506,7'), item('KRW', '33.71', 100), item('IRR', '2.41', 10000)]))
  assert.equal(r.date, '2026-11-04')
  assert.deepEqual(r.rates, { USD: 453.26, EUR: 506.7, KRW: 0.3371, IRR: 0.000241 })
})

test('parseNbkXml: пустой ответ и мусор → null', () => {
  assert.equal(parseNbkXml(xml('05.11.2026', [])), null)
  assert.equal(parseNbkXml('<html/>'), null)
  assert.equal(parseNbkXml(xml('04.11.2026', [item('USD', 'abc'), item('EUR', '0'), item('RUB', '5', 0)])), null)
})

test('даты: Алматы переходит на новый день раньше UTC', () => {
  assert.equal(almatyToday(new Date('2026-11-04T18:59:00Z')), '2026-11-04')
  assert.equal(almatyToday(new Date('2026-11-04T19:00:00Z')), '2026-11-05')
})

test('addDays / datesBetween / isIsoDate', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2024-03-01', -1), '2024-02-29')
  assert.deepEqual(datesBetween('2026-10-30', '2026-11-02'), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  assert.deepEqual(datesBetween('2026-11-02', '2026-11-01'), [])
  assert.equal(isIsoDate('2026-11-04'), true)
  assert.equal(isIsoDate('2026-13-40'), false)
  assert.equal(isIsoDate('04-11-2026'), false)
})

test('buildRecord / sameRates', () => {
  const rec = buildRecord({ date: '2026-11-04', rates: { USD: 1 } }, '2026-11-04T00:00:00.000Z')
  assert.deepEqual(rec, {
    date: '2026-11-04',
    source: 'https://nationalbank.kz/rss/get_rates.cfm?fdate=04.11.2026',
    fetchedAt: '2026-11-04T00:00:00.000Z',
    rates: { USD: 1 },
  })
  assert.equal(sameRates({ USD: 1, EUR: 2 }, { EUR: 2, USD: 1 }), true)
  assert.equal(sameRates({ USD: 1 }, { USD: 2 }), false)
  assert.equal(sameRates({ USD: 1 }, { USD: 1, EUR: 2 }), false)
})
