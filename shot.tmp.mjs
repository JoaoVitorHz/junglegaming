import { chromium } from 'playwright'
const S = process.env.S
const [,, ...targets] = process.argv
const browser = await chromium.launch()
for (const t of targets) {
  const [name, w, h, path] = t.split('|')
  const page = await browser.newPage({ viewport: { width: +w, height: +h } })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 140)))
  await page.goto('http://localhost:5173' + path)
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${S}/${name}.png`, fullPage: true })
  if (errs.length) console.log(name, errs)
  await page.close()
}
await browser.close()
