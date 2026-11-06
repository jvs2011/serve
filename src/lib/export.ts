import type { AppData } from '../data/types'
import { formatPhone } from './people'

/** Planilha de pessoas (CSV com ; e acentos, abre direto no Excel/Google Planilhas) */
export function peopleCsv(d: AppData): string {
  const min = (id: string) => d.ministries.find((m) => m.id === id)?.name ?? id
  const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const head = ['Nome', 'Celular', 'PIN criado', 'Acesso', 'Ministérios e funções', 'Líder de', 'Interesse em', 'Origem', 'Cadastrado em']
  const rows = [...d.members].sort((a, b) => a.name.localeCompare(b.name)).map((m) => [
    m.name,
    m.phone ? formatPhone(m.phone) : '',
    m.hasPin ? 'Sim' : 'Não',
    m.access === 'admin' ? 'Administrador' : m.access === 'leader' ? 'Líder' : 'Voluntário',
    m.ministries.map((mm) => `${min(mm.ministryId)}${mm.roles.length ? ` (${mm.roles.join(', ')})` : ''}`).join(' | '),
    d.ministries.filter((x) => x.leaderIds.includes(m.id)).map((x) => x.name).join(', '),
    (m.interests ?? []).map((i) => `${min(i.ministryId)} (${i.roles.join(', ')})`).join(' | '),
    m.source === 'form' ? 'Formulário' : 'App',
    m.createdAt ? new Date(m.createdAt).toLocaleDateString('pt-BR') : '',
  ])
  return '\uFEFF' + [head, ...rows].map((r) => r.map((c) => esc(String(c))).join(';')).join('\r\n')
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
