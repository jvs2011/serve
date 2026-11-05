import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * Em `npm run dev`, atende as rotas /api com o mesmo código das funções da Vercel,
 * usando um banco em memória (apagado ao reiniciar) se não houver Upstash configurado.
 */
function devApi(): Plugin {
  return {
    name: 'serve-dev-api',
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

// `npm run build:single` gera um único index.html (útil para pré-visualização/compartilhamento)
export default defineConfig(({ mode }) => ({
  plugins: [react(), devApi(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
}))
