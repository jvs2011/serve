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

/** Planilha da equipe de um ministério (painel do líder) */
export function teamCsv(rows: import('./panel').TeamRow[], today: string): string {
  const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const br = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')
  const head = ['Nome', 'Celular', 'Funções', `Escalas em ${today.slice(5, 7)}/${today.slice(0, 4)}`, 'Limite por mês', 'Próxima escala', 'Última vez que serviu', 'Confirma (%)', 'Dias indisponível (30 dias)']
  const lines = rows.map((r) => [
    r.member.name, r.member.phone ? formatPhone(r.member.phone) : '', r.roles.join(', '), String(r.month), String(r.member.maxPerMonth),
    r.next ? `${br(r.next.ev.date)} ${r.next.ev.title} (${r.next.a.role})` : '', br(r.last), r.confirmRate === null ? '' : String(r.confirmRate), String(r.off),
  ])
  return '﻿' + [head, ...lines].map((r) => r.map((c) => esc(c)).join(';')).join('\r\n')
}
