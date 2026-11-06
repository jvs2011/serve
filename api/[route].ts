import type { IncomingMessage, ServerResponse } from 'node:http'
import { handle } from '../server/http.js'

/**
 * Uma única função da Vercel para todas as rotas /api/<rota>
 * (o plano gratuito permite no máximo 12 funções por projeto).
 */
export default function handler(req: IncomingMessage, res: ServerResponse) {
  const name = (req.url ?? '').split('?')[0].replace(/^\/api\//, '').replace(/\/+$/, '')
  return handle(name, req, res)
}
