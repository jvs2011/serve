/*
 * Armazenamento do servidor.
 * Produção: Upstash Redis (criado pelo painel da Vercel → Storage), via API REST.
 * Desenvolvimento/testes: memória (SERVE_MEMORY_DB=1), apagada ao reiniciar.
 */

export interface Store {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
  /** Grava só se a chave ainda não existir; retorna true se gravou */
  setNX(key: string, value: string, ttlSeconds?: number): Promise<boolean>
  /** Incrementa um contador; aplica o prazo de expiração na primeira vez */
  incr(key: string, ttlSeconds: number): Promise<number>
  /** Documento principal (todos os dados) e sua versão */
  getDoc(): Promise<{ doc: string | null; version: number }>
  /** Só a versão do documento (leve: usada para saber se algo mudou) */
  getVersion(): Promise<number>
  /** Grava o documento só se a versão ainda for `expected` (evita uma alteração apagar outra) */
  casDoc(expected: number, doc: string): Promise<boolean>
}

const DOC = 'serve:db'
const VER = 'serve:db:v'

function upstashEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url: url.replace(/\/$/, ''), token } : null
}

export function storageSecret(): string {
  return process.env.AUTH_SECRET || upstashEnv()?.token || 'serve-dev-secret'
}

class UpstashStore implements Store {
  constructor(private url: string, private token: string) {}

  private async call<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(this.url + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text()}`)
    return res.json() as Promise<T>
  }

  private async cmd(...args: (string | number)[]): Promise<unknown> {
    const r = await this.call<{ result?: unknown; error?: string }>('', args)
    if (r.error) throw new Error(`Upstash: ${r.error}`)
    return r.result
  }

  async get(key: string) { return (await this.cmd('GET', key)) as string | null }
  async set(key: string, value: string, ttl?: number) { await (ttl ? this.cmd('SET', key, value, 'EX', ttl) : this.cmd('SET', key, value)) }
  async del(key: string) { await this.cmd('DEL', key) }
  async setNX(key: string, value: string, ttl?: number) {
    return (await (ttl ? this.cmd('SET', key, value, 'NX', 'EX', ttl) : this.cmd('SET', key, value, 'NX'))) === 'OK'
  }
  async incr(key: string, ttl: number) {
    const r = await this.call<{ result?: number; error?: string }[]>('/pipeline', [['INCR', key], ['EXPIRE', key, ttl, 'NX']])
    return Number(r[0]?.result ?? 0)
  }
  async getVersion() { return Number((await this.get(VER)) ?? 0) }
  async getDoc() {
    const r = await this.call<{ result?: string | null }[]>('/pipeline', [['GET', DOC], ['GET', VER]])
    return { doc: r[0]?.result ?? null, version: Number(r[1]?.result ?? 0) }
  }
  async casDoc(expected: number, doc: string) {
    const script = `local v = redis.call('GET', KEYS[2])
if (v == false and ARGV[1] == '0') or v == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2])
  redis.call('SET', KEYS[2], ARGV[3])
  return 1
end
return 0`
    return Number(await this.cmd('EVAL', script, 2, DOC, VER, String(expected), doc, String(expected + 1))) === 1
  }
}

class MemoryStore implements Store {
  private map = new Map<string, { value: string; exp?: number }>()
  private live(key: string) {
    const e = this.map.get(key)
    if (e?.exp && Date.now() > e.exp) { this.map.delete(key); return undefined }
    return e
  }
  async get(key: string) { return this.live(key)?.value ?? null }
  async set(key: string, value: string, ttl?: number) { this.map.set(key, { value, exp: ttl ? Date.now() + ttl * 1000 : undefined }) }
  async del(key: string) { this.map.delete(key) }
  async setNX(key: string, value: string, ttl?: number) {
    if (this.live(key)) return false
    await this.set(key, value, ttl)
    return true
  }
  async incr(key: string, ttl: number) {
    const e = this.live(key)
    const n = Number(e?.value ?? 0) + 1
    this.map.set(key, { value: String(n), exp: e?.exp ?? Date.now() + ttl * 1000 })
    return n
  }
  async getDoc() { return { doc: await this.get(DOC), version: Number((await this.get(VER)) ?? 0) } }
  async getVersion() { return Number((await this.get(VER)) ?? 0) }
  async casDoc(expected: number, doc: string) {
    if (Number((await this.get(VER)) ?? 0) !== expected) return false
    await this.set(DOC, doc)
    await this.set(VER, String(expected + 1))
    return true
  }
}

let memory: MemoryStore | null = null

/** null = servidor ainda sem banco configurado */
export function getStore(): Store | null {
  const env = upstashEnv()
  if (env) return new UpstashStore(env.url, env.token)
  if (process.env.SERVE_MEMORY_DB === '1') return (memory ??= new MemoryStore())
  return null
}
