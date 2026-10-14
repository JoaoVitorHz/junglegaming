/**
 * Executa a auditoria Lighthouse e grava relatórios HTML/JSON por medição,
 * além de summary.json/summary.md com as medianas por página e perfil.
 *
 * Uso: npm run audit   (faz o build antes)
 */
import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { CATEGORIES, METRICS, PAGES, PORT, PROFILES, RUNS } from './config.mjs'

const OUT = path.resolve('lighthouse/reports')
const BASE = `http://localhost:${PORT}`

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

async function startPreview() {
  // 'serve' comprime as respostas (gzip), como a CDN do deploy; o vite preview não comprime.
  const child = spawn('npx', ['serve', '-s', 'dist', '-l', String(PORT), '--no-clipboard'], {
    stdio: 'ignore',
    shell: true,
  })
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(BASE)
      if (res.ok) return child
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  child.kill()
  throw new Error('servidor estático não respondeu')
}

function stopPreview(child) {
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else child.kill()
}

async function main() {
  await rm(OUT, { recursive: true, force: true })
  await mkdir(OUT, { recursive: true })
  const server = await startPreview()
  const results = []
  let chromeVersion = 'n/d'
  let lighthouseVersion = 'n/d'

  try {
    for (const page of PAGES) {
      for (const profile of PROFILES) {
        const runs = []
        for (let run = 1; run <= RUNS; run++) {
          const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-first-run', '--disable-extensions'] })
          try {
            const result = await lighthouse(`${BASE}${page.path}`, { port: chrome.port, output: ['html', 'json'], logLevel: 'error' }, profile.config)
            const lhr = result.lhr
            chromeVersion = lhr.environment.hostUserAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? chromeVersion
            lighthouseVersion = lhr.lighthouseVersion
            const base = `${page.id}-${profile.id}-run${run}`
            await writeFile(path.join(OUT, `${base}.report.html`), result.report[0])
            await writeFile(path.join(OUT, `${base}.report.json`), result.report[1])
            const scores = Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)]))
            const metrics = Object.fromEntries(METRICS.map((m) => [m.label, lhr.audits[m.id]?.numericValue ?? null]))
            runs.push({ run, scores, metrics, warnings: lhr.runWarnings })
            console.log(`${page.id} ${profile.id} #${run}`, JSON.stringify(scores), `LCP ${Math.round(metrics.LCP)}ms CLS ${metrics.CLS?.toFixed(3)} TBT ${Math.round(metrics.TBT)}ms`)
          } finally {
            await chrome.kill()
          }
        }
        results.push({
          page: page.id,
          path: page.path,
          profile: profile.id,
          median: {
            scores: Object.fromEntries(CATEGORIES.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
            metrics: Object.fromEntries(METRICS.map((m) => [m.label, median(runs.map((r) => r.metrics[m.label]))])),
          },
          runs,
        })
      }
    }
  } finally {
    stopPreview(server)
  }

  const environment = {
    date: new Date().toISOString(),
    lighthouse: lighthouseVersion,
    chrome: chromeVersion,
    node: process.version,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: os.cpus()[0]?.model ?? 'n/d',
    cores: os.cpus().length,
    memoryGb: Math.round(os.totalmem() / 1024 ** 3),
    server: 'serve -s dist (build de produção, gzip) com VITE_ENABLE_MOCKS=true e cenário padrão dos mocks',
    runsPerPageAndProfile: RUNS,
    mobileConditions: 'Padrão do Lighthouse: Moto G Power emulado, throttling simulado (RTT 150 ms, 1,6 Mbps, CPU 4×)',
    desktopConditions: 'Preset desktop do Lighthouse: 1350×940, RTT 40 ms, 10 Mbps, sem throttling de CPU',
  }
  await writeFile(path.join(OUT, 'summary.json'), JSON.stringify({ environment, results }, null, 2))

  const fmt = (label, v) => (v == null ? '–' : label === 'CLS' ? v.toFixed(3) : `${Math.round(v)} ms`)
  const lines = [
    '# Lighthouse — resumo (medianas de 3 medições)',
    '',
    `- Data: ${environment.date}`,
    `- Ferramentas: Lighthouse ${environment.lighthouse} · Chrome ${environment.chrome} · Node ${environment.node}`,
    `- Máquina: ${environment.os}, ${environment.cpu} (${environment.cores} núcleos), ${environment.memoryGb} GB`,
    `- Servidor: ${environment.server}`,
    `- Mobile: ${environment.mobileConditions}`,
    `- Desktop: ${environment.desktopConditions}`,
    '',
    '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...results.map(
      (r) =>
        `| ${r.page} | ${r.profile} | ${r.median.scores.performance} | ${r.median.scores.accessibility} | ${r.median.scores['best-practices']} | ${r.median.scores.seo} | ${fmt('LCP', r.median.metrics.LCP)} | ${fmt('CLS', r.median.metrics.CLS)} | ${fmt('TBT', r.median.metrics.TBT)} |`,
    ),
    '',
    'Relatórios completos: `lighthouse/reports/<pagina>-<perfil>-run<n>.report.html|json`.',
  ]
  await writeFile(path.join(OUT, 'summary.md'), lines.join('\n') + '\n')
  console.log(lines.join('\n'))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
