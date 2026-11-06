import type { IncomingMessage, ServerResponse } from 'node:http'
import { handle } from '../server/http.js'

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handle('signup-info', req, res)
}
