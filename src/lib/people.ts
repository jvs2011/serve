/** Utilidades de cadastro: telefone e iniciais (usadas no app e no servidor). */

/** Só dígitos, sem o 55 do Brasil: "(16) 99999-1234" → "16999991234" */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
  return d
}

export function isValidPhone(raw: string): boolean {
  const d = normalizePhone(raw)
  return d.length === 10 || d.length === 11
}

/** "16999991234" → "(16) 99999-1234" */
export function formatPhone(raw: string): string {
  const d = normalizePhone(raw)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return raw
}

const CONNECTORS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'di', 'du', 'del', 'van', 'von'])

/** Iniciais usadas no login: "João Victor da Silva" → "JVS" (ignora de/da/do/dos/das/e) */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter((w) => w && !CONNECTORS.has(w.toLowerCase()))
    .map((w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '')[0]?.toUpperCase() ?? '')
    .join('')
}

/** "JVS" → "J V S" */
export function spaced(initials: string): string {
  return initials.split('').join(' ')
}

// Letras mais comuns no começo de nomes e sobrenomes brasileiros (opções falsas parecem reais)
const COMMON = 'AABBCCDDEFFGGHIJJJKLLLMMMMNOPPRRRSSSSTTVVWZ'

/**
 * Gera `count` opções de iniciais falsas com o mesmo tamanho da verdadeira.
 * `random` deve ser determinístico por telefone (o servidor usa um gerador com semente),
 * para que pedir o login várias vezes não revele qual opção sempre se repete.
 */
export function decoyInitials(correct: string, count: number, random: () => number): string[] {
  const len = Math.max(2, Math.min(5, correct.length || 3))
  const out = new Set<string>()
  let guard = 0
  while (out.size < count && guard++ < 1000) {
    let s = ''
    for (let i = 0; i < len; i++) s += COMMON[Math.floor(random() * COMMON.length)]
    if (s !== correct) out.add(s)
  }
  return [...out]
}

/** Gerador pseudoaleatório com semente (mulberry32) */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** "joão VICTOR DA silva" → "João Victor da Silva" */
export function tidyName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && CONNECTORS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}
