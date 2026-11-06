/*
 * Gera as imagens de prévia de link (WhatsApp, Instagram etc.) em public/og/:
 *   app.jpg                → link do app
 *   cadastro-<id>.jpg      → formulário de cadastro de cada ministério
 * Uso: node scripts/og-images.mjs   (precisa do Playwright com Chromium instalado)
 * Rode de novo quando mudar nome/descrição/cor de um ministério.
 */
import { readFileSync, mkdirSync } from 'node:fs'
import { createServer } from 'vite'
import { createRequire } from 'node:module'

// Playwright fica instalado fora do projeto (não é dependência do app)
const { chromium } = createRequire(import.meta.url)('playwright')

const root = new URL('..', import.meta.url).pathname
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { ministryList } = await vite.ssrLoadModule('/src/data/seed.ts')
await vite.close()

const b64 = (p) => readFileSync(root + p).toString('base64')
const lagoinha = `data:image/png;base64,${b64('public/lagoinha-franca.png')}`
const FONT = 'https://fonts.googleapis.com/css2?family=Golos+Text:wght@500;600;700;800&display=block'

const page = (accent, body) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONT}">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; font-family: 'Golos Text', sans-serif; color: #fff;
    background: #0E0E10; position: relative; }
  .glow { position: absolute; inset: 0; background:
    radial-gradient(55% 75% at 92% 8%, ${accent}cc, transparent 70%),
    radial-gradient(40% 60% at 0% 100%, ${accent}33, transparent 70%); }
  .wrap { position: relative; height: 100%; padding: 64px 72px; display: flex; flex-direction: column; }
  .top { display: flex; justify-content: space-between; align-items: center; }
  .logo { font-weight: 800; font-size: 54px; letter-spacing: -0.045em; line-height: 1; }
  .logo i { font-style: normal; color: #E57A47; }
  .church { height: 58px; }
  .main { margin-top: auto; }
  .kicker { font-size: 26px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,.75); }
  h1 { font-size: 132px; font-weight: 800; letter-spacing: -0.045em; line-height: .95; margin-top: 10px; }
  h1.app { font-size: 92px; line-height: 1.02; }
  h1 em { font-style: normal; color: #E57A47; }
  .sub { font-size: 34px; font-weight: 500; color: rgba(255,255,255,.82); margin-top: 18px; }
  .cta { display: inline-flex; align-items: center; gap: 14px; margin-top: 34px; background: ${accent}; color: #fff;
    font-weight: 700; font-size: 30px; padding: 18px 30px; border-radius: 18px; }
</style></head><body><div class="glow"></div><div class="wrap">
  <div class="top"><span class="logo">serve<i>.</i></span><img class="church" src="${lagoinha}"></div>
  <div class="main">${body}</div>
</div></body></html>`

mkdirSync(root + 'public/og', { recursive: true })
const browser = await chromium.launch()
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } })
const shot = async (file, html) => {
  await tab.setContent(html, { waitUntil: 'networkidle' })
  await tab.evaluate(() => document.fonts.ready)
  await tab.screenshot({ path: root + 'public/og/' + file, type: 'jpeg', quality: 88 })
  console.log('ok', file)
}

await shot('app.jpg', page('#E57A47', `
  <h1 class="app">Servir é um <em>privilégio.</em></h1>
  <p class="sub">Escalas de voluntários dos ministérios da Lagoinha Franca</p>`))

for (const m of ministryList()) {
  await shot(`cadastro-${m.id}.jpg`, page(m.color, `
    <p class="kicker">Cadastro de voluntários</p>
    <h1>${m.name}</h1>
    <p class="sub">${m.description.split(':')[0]}</p>
    <span class="cta">Faça seu cadastro em 1 minuto →</span>`))
}
await browser.close()
