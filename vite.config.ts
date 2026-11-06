import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import { ministryList } from './src/data/seed'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * Em `npm run dev`, atende as rotas /api com o mesmo código das funções da Vercel,
 * usando um banco em memória (apagado ao reiniciar) se não houver Upstash configurado.
 */
function devApi(): Plugin {
  return {
    name: 'serve-dev-api',
    // `vite preview` (build de produção local) também atende /api, para testar o app instalado
    async configurePreviewServer(server) {
      process.env.SERVE_MEMORY_DB ??= '1'
      process.env.ADMIN_PHONE ??= '16999990000'
      process.env.ADMIN_NAME ??= 'Administrador Teste'
      const { createServer } = await import('vite')
      const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if (!path.startsWith('/api/')) return next()
        const { handle } = await vite.ssrLoadModule('/server/http.ts')
        await handle(path.slice(5), req, res)
      })
    },
    configureServer(server) {
      process.env.SERVE_MEMORY_DB ??= '1'
      if (!process.env.ADMIN_PHONE) {
        process.env.ADMIN_PHONE = '16999990000'
        process.env.ADMIN_NAME ??= 'Administrador Teste'
        server.config.logger.info('  Serve (dev): admin de teste → celular (16) 99999-0000, iniciais A T')
      }
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if (!path.startsWith('/api/')) return next()
        const { handle } = await server.ssrLoadModule('/server/http.ts')
        await handle(path.slice(5), req, res)
      })
    },
  }
}

const SITE = 'https://serve.lagoinhafranca.com'
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/**
 * Gera dist/cadastro/<ministério>.html: o mesmo app, mas com título, descrição e imagem
 * próprios para a prévia do link no WhatsApp (que não executa JavaScript).
 */
function signupPages(outDir: string): Plugin {
  return {
    name: 'serve-signup-pages',
    apply: 'build',
    closeBundle() {
      const html = readFileSync(`${outDir}/index.html`, 'utf8')
      const start = html.indexOf('<!-- og:start')
      const end = html.indexOf('<!-- og:end -->')
      if (start < 0 || end < 0) throw new Error('index.html sem o bloco og:start/og:end')
      mkdirSync(`${outDir}/cadastro`, { recursive: true })
      for (const m of ministryList()) {
        const title = `Cadastro de voluntários · ${m.name}`
        const desc = `${m.description.split(':')[0]} · Lagoinha Franca. Preencha em 1 minuto: nome, celular e as equipes em que você serve.`
        const block = `<title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <meta property="og:site_name" content="Serve · Lagoinha Franca" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${SITE}/cadastro/${m.id}" />
    <meta property="og:image" content="${SITE}/og/cadastro-${m.id}.jpg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(title)}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="pt_BR" />
    <meta name="twitter:card" content="summary_large_image" />
    `
        const page = html.slice(0, start) + block + html.slice(end + '<!-- og:end -->'.length)
        writeFileSync(`${outDir}/cadastro/${m.id}.html`, page.replace(/<meta name="description" content="Serve — [^"]*" \/>\n\s*/, ''))
      }
    },
  }
}

// `npm run build:single` gera um único index.html (útil para pré-visualização/compartilhamento)
export default defineConfig(({ mode }) => ({
  plugins: [react(), devApi(), ...(mode === 'single' ? [viteSingleFile()] : [signupPages('dist')])],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
}))
