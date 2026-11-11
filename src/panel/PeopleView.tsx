import { useEffect, useMemo, useState } from 'react'
import { Check, Download, KeyRound, Search, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { downloadText, peopleCsv } from '../lib/export'
import { formatPhone, isValidPhone, nextPhoneValue } from '../lib/people'
import { Avatar, MinistryBadge } from '../components/ui'
import { Modal } from './common'
import type { MemberInput } from '../data/actions'
import type { Member } from '../data/types'

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
type Filter = 'all' | 'leaders' | 'nopin' | 'form' | 'norole'

/** Coordenação: todas as pessoas cadastradas, com funções, líderes, PIN e origem do cadastro */
export function PeopleView() {
  const { data, mode, reload } = useStore()
  useEffect(() => { reload() }, [reload])
  const [q, setQ] = useState('')
  const [ministry, setMinistry] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Member | 'new' | null>(null)
  const min = (id: string) => data.ministries.find((m) => m.id === id)
  const isLeader = (m: Member) => data.ministries.some((x) => x.leaderIds.includes(m.id))
  const noRole = (m: Member) => !m.ministries.length || m.ministries.some((mm) => !mm.roles.length && !min(mm.ministryId)?.leaderIds.includes(m.id))

  const list = useMemo(() => {
    const f = fold(q.trim())
    const digits = q.replace(/\D/g, '')
    return [...data.members]
      .filter((m) => !f || fold(m.name).includes(f) || (digits.length >= 3 && m.phone.includes(digits)))
      .filter((m) => !ministry || m.ministries.some((mm) => mm.ministryId === ministry))
      .filter((m) => filter === 'all' || (filter === 'leaders' ? isLeader(m) || m.access === 'admin' : filter === 'nopin' ? !m.hasPin : filter === 'form' ? m.source === 'form' : noRole(m)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data, q, ministry, filter])
  const count = (f: Filter) => data.members.filter((m) => f === 'leaders' ? isLeader(m) || m.access === 'admin' : f === 'nopin' ? !m.hasPin : f === 'form' ? m.source === 'form' : noRole(m)).length
  const filters: [Filter, string][] = [['all', `Todos (${data.members.length})`], ['leaders', `Líderes e coordenação (${count('leaders')})`],
    ...(mode === 'live' ? [['nopin', `Sem PIN (${count('nopin')})`] as [Filter, string]] : []), ['form', `Pelo formulário (${count('form')})`], ['norole', `Sem função (${count('norole')})`]]

  return (
    <div className="pn-page">
      <header className="pn-head">
        <div>
          <h1>Pessoas</h1>
          <p>Cadastro de todos os voluntários: ministérios, funções, quem é líder e o acesso ao app.</p>
        </div>
        <div className="pn-head-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => downloadText(`serve-pessoas-${new Date().toISOString().slice(0, 10)}.csv`, peopleCsv(data))}><Download size={15} /> Baixar planilha</button>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><UserPlus size={16} /> Cadastrar pessoa</button>
        </div>
      </header>
      <div className="pn-toolbar">
        <label className="pn-search">
          <Search size={16} />
          <input placeholder="Buscar por nome ou celular" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="pn-select" value={ministry} onChange={(e) => setMinistry(e.target.value)}>
          <option value="">Todos os ministérios</option>
          {data.ministries.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div className="chips">
          {filters.map(([f, label]) => <button key={f} className={`chip${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>{label}</button>)}
        </div>
      </div>
      <div className="pn-card pn-card-flush">
        <table className="pn-table pn-people-table">
          <thead><tr><th>Pessoa</th><th>Celular</th><th>Ministérios e funções</th>{mode === 'live' && <th>PIN</th>}<th>Cadastro</th></tr></thead>
          <tbody>
            {list.slice(0, 300).map((m) => (
              <tr key={m.id} className="pn-click" onClick={() => setEditing(m)}>
                <td>
                  <div className="pn-person">
                    <Avatar name={m.name} size={32} />
                    <div>
                      <strong>{m.name}</strong>
                      {m.access === 'admin' && <span className="tag pn-tag-leader">coordenação</span>}
                      {m.access !== 'admin' && isLeader(m) && <span className="tag pn-tag-leader">líder</span>}
                      {m.interests?.some((i) => i.roles.length) && <span className="muted small block">Interesse: {m.interests.flatMap((i) => i.roles).join(', ')}</span>}
                    </div>
                  </div>
                </td>
                <td className="nowrap small">{m.phone ? formatPhone(m.phone) : <span className="muted">—</span>}</td>
                <td>
                  <span className="tags">
                    {m.ministries.map((mm) => {
                      const x = min(mm.ministryId)
                      const leads = x?.leaderIds.includes(m.id)
                      return <span key={mm.ministryId} className={`tag${!mm.roles.length && !leads ? ' warn' : ''}`}>{x?.name ?? mm.ministryId}{mm.roles.length ? `: ${mm.roles.join(', ')}` : leads ? ': líder' : ': sem função'}</span>
                    })}
                    {!m.ministries.length && <span className="tag warn">Sem ministério</span>}
                  </span>
                </td>
                {mode === 'live' && <td className="nowrap small">{m.hasPin ? <span className="ok">Criou</span> : <span className="muted">Ainda não</span>}</td>}
                <td className="nowrap small">{m.createdAt ? new Date(m.createdAt).toLocaleDateString('pt-BR') : '—'}<span className="muted block">{m.source === 'form' ? 'Formulário' : 'App'}</span></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={5} className="pn-empty">Ninguém encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
      {list.length > 300 && <p className="muted small pn-foot-note">Mostrando 300 de {list.length}. Use a busca ou os filtros.</p>}
      {editing && <PersonEditor member={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** Cadastro ou edição de uma pessoa (mesmas regras do app), lado a lado: dados e ministérios */
export function PersonEditor({ member, onClose }: { member?: Member; onClose: () => void }) {
  const { data, actions, notify, mode } = useStore()
  const me = useMe()
  const [name, setName] = useState(member?.name ?? '')
  const [phone, setPhone] = useState(member ? formatPhone(member.phone) : '')
  const [admin, setAdmin] = useState(member?.access === 'admin')
  const [mins, setMins] = useState<MemberInput['ministries']>(() => (member?.ministries ?? []).map((mm) => ({
    ministryId: mm.ministryId, roles: mm.roles, leader: data.ministries.find((x) => x.id === mm.ministryId)?.leaderIds.includes(member!.id) ?? false,
  })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const isSelf = member?.id === me.id
  const sel = (mid: string) => mins.find((m) => m.ministryId === mid)
  const toggleMinistry = (mid: string) => setMins((s) => (sel(mid) ? s.filter((m) => m.ministryId !== mid) : [...s, { ministryId: mid, roles: [], leader: false }]))
  const update = (mid: string, fn: (m: MemberInput['ministries'][number]) => MemberInput['ministries'][number]) => setMins((s) => s.map((m) => (m.ministryId === mid ? fn(m) : m)))
  const missing = mins.filter((m) => !m.roles.length && !m.leader)
  const canSave = name.trim().split(/\s+/).length >= 2 && isValidPhone(phone) && !saving

  const save = async () => {
    setSaving(true); setError('')
    const r = await actions.saveMember({ id: member?.id, name, phone, admin, ministries: mins })
    setSaving(false)
    if (!r.ok) return setError(r.error)
    notify(member ? 'Cadastro atualizado' : `${name.trim().split(' ')[0]} cadastrado(a). No primeiro acesso, a pessoa cria o PIN.`)
    onClose()
  }
  const remove = async () => {
    if (!member) return
    setSaving(true)
    const r = await actions.removeMember(member.id)
    setSaving(false)
    if (!r.ok) return setError(r.error)
    notify(`${member.name} foi removido(a)`)
    onClose()
  }

  return (
    <Modal title={member ? member.name : 'Cadastrar pessoa'} subtitle={member ? 'Editar cadastro' : 'No primeiro acesso, a pessoa entra com o celular e cria o PIN.'} onClose={onClose} width={920}
      footer={<>
        {member && !isSelf && (confirmRemove
          ? <span className="pn-inline-confirm grow"><span className="small">Remover {member.name.split(' ')[0]}? As escalas futuras saem.</span><button className="btn btn-ghost btn-sm" onClick={() => setConfirmRemove(false)}>Não</button><button className="btn btn-danger btn-sm" disabled={saving} onClick={remove}>Remover</button></span>
          : <button className="btn btn-ghost pn-danger-text" onClick={() => setConfirmRemove(true)}><Trash2 size={16} /> Remover pessoa</button>)}
        <span className="grow" />
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!canSave} onClick={save}>{saving ? 'Salvando…' : member ? 'Salvar alterações' : 'Cadastrar'}</button>
      </>}>
      <div className="pn-person-editor">
        <div className="pn-pe-left">
          <label className="field"><span>Nome completo</span><input id="pe-name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: João Victor da Silva" /></label>
          <label className="field"><span>Celular com DDD</span><input id="pe-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone((p) => nextPhoneValue(p, e.target.value))} placeholder="(16) 99999-9999" /></label>
          {member && mode === 'live' && (
            <div className="pn-pe-box">
              <KeyRound size={16} />
              <span className="grow small">{member.hasPin ? 'Já criou o PIN de acesso' : 'Ainda não criou o PIN (cria no primeiro acesso)'}</span>
              {member.hasPin && !isSelf && <button className="btn btn-ghost btn-sm" disabled={saving} onClick={async () => {
                const r = await actions.resetPin(member.id)
                notify(r.ok ? `PIN redefinido. ${member.name.split(' ')[0]} cria um novo no próximo acesso.` : r.error)
              }}>Redefinir PIN</button>}
            </div>
          )}
          <label className="pn-pe-box pn-pe-switch">
            <ShieldCheck size={16} />
            <span className="grow"><strong className="small">Coordenação (administrador)</strong><span className="muted small block">Cadastra pessoas e cuida de todos os ministérios e da agenda</span></span>
            <input type="checkbox" checked={admin} disabled={isSelf} onChange={(e) => setAdmin(e.target.checked)} />
          </label>
          {member?.interests?.some((i) => i.roles.length) && (
            <div className="pn-pe-box pn-pe-interest">
              <strong className="small">Tem interesse em participar</strong>
              {member.interests.filter((i) => i.roles.length).map((i) => <span key={i.ministryId} className="small">{data.ministries.find((m) => m.id === i.ministryId)?.name}: {i.roles.join(', ')}</span>)}
              <span className="muted small">Informado no formulário{member.createdAt ? ` em ${new Date(member.createdAt).toLocaleDateString('pt-BR')}` : ''}.</span>
            </div>
          )}
          {member?.createdAt && <p className="muted small">Cadastrado em {new Date(member.createdAt).toLocaleDateString('pt-BR')} · {member.source === 'form' ? 'pelo formulário' : 'pelo app'}</p>}
          {missing.length > 0 && <p className="warn-box">Sem função marcada em {missing.map((x) => data.ministries.find((m) => m.id === x.ministryId)?.name).join(', ')}: a pessoa não entra na escala desse ministério.</p>}
          {error && <p className="error">{error}</p>}
        </div>
        <div className="pn-pe-right">
          <span className="field-label">Ministérios, funções e liderança</span>
          <div className="pn-pe-mins">
            {data.ministries.map((m) => {
              const s = sel(m.id)
              return (
                <div key={m.id} className={`pn-pe-min${s ? ' on' : ''}`}>
                  <button className="pn-pe-min-head" onClick={() => toggleMinistry(m.id)} aria-pressed={!!s}>
                    <span className={`pn-box${s ? ' on' : ''}`}>{s && <Check size={13} />}</span>
                    <MinistryBadge ministry={m} size={24} />
                    <strong className="grow">{m.name}</strong>
                    {s && <label className="pn-check small" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={s.leader} onChange={(e) => update(m.id, (x) => ({ ...x, leader: e.target.checked }))} /> Líder</label>}
                  </button>
                  {s && (
                    <div className="chips">
                      {m.roles.map((r) => {
                        const on = s.roles.includes(r.name)
                        return <button key={r.name} className={`chip${on ? ' on' : ''}`} onClick={() => update(m.id, (x) => ({ ...x, roles: on ? x.roles.filter((y) => y !== r.name) : [...x.roles, r.name] }))}>{r.name}</button>
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
