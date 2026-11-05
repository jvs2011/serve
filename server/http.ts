import type { IncomingMessage, ServerResponse } from 'node:http'
import { route } from './app.js'

type Req = IncomingMessage & { body?: unknown }

async function readBody(req: Req): Promise<unknown> {
  if (req.body !== undefined) return typeof req.body === 'string' ? safeJson(req.body) : req.body
  if (req.method === 'GET' || req.method === 'HEAD') return null
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > 512 * 1024) break
    chunks.push(chunk as Buffer)
  }
  return safeJson(Buffer.concat(chunks).toString('utf8'))
}

function safeJson(s: string) {
  try { return s ? JSON.parse(s) : null } catch { return null }
}

/** Adaptador HTTP comum às funções da Vercel (/api) e ao servidor de desenvolvimento */
export async function handle(name: string, req: Req, res: ServerResponse) {
  const body = await readBody(req)
  const reply = await route(name, req.method ?? 'GET', body, req.headers.authorization)
  res.statusCode = reply.status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(reply.body))
}
