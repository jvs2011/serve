import { useMemo, useState } from 'react'
import { Check, ChevronRight, Search, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { useNav } from '../nav'
import { formatPhone, initialsOf, isValidPhone, nextPhoneValue, spaced } from '../lib/people'
import { Avatar, Empty, MinistryBadge, TopBar } from '../components/ui'
import type { MemberInput } from '../data/actions'

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Lista de pessoas cadastradas (somente administrador) */
export function People() {
  const { data } = useStore()
  const { back, push } = useNav()
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const f = fold(q.trim())
    const digits = q.replace(/\D/g, '')
    return [...data.members]
      .filter((m) => !f || fold(m.name).includes(f) || (digits.length >= 3 && m.phone.includes(digits)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data.members, q])

  return (
    <div className="screen">
      <TopBar
        title="Pessoas"
        subtitle={`${data.members.length} ${data.members.length === 1 ? 'pessoa cadastrada' : 'pessoas cadastradas'}`}
        onBack={back}
        right={<button className="icon-btn filled" onClick={() => push({ name: 'person' })} aria-label="Cadastrar pessoa"><UserPlus size={20} /></button>}
      />
      <label className="search">
        <Search size={18} />
        <input id="people-search" placeholder="Buscar por nome ou celular" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      {list.length === 0 ? (
        <Empty icon={<Users />} title={q ? 'Ninguém encontrado' : 'Nenhuma pessoa cadastrada'} text={q ? 'Confira o nome ou o número.' : 'Toque em + para cadastrar a primeira pessoa.'} />
      ) : (
        <div className="card list-card">
          {list.map((m) => {
            const leads = data.ministries.filter((x) => x.leaderIds.includes(m.id))
            return (
              <button key={m.id} className="person-row" onClick={() => push({ name: 'person', id: m.id })}>
                <Avatar name={m.name} size={40} />
                <div className="grow">
                  <strong>
                    {m.name}
                    {m.access === 'admin' && <em className="best">admin</em>}
                    {m.access !== 'admin' && leads.length > 0 && <em className="best">líder</em>}
                    {m.source === 'form' && <em className="best tag-form">formulário</em>}
                  </strong>
                  <span className="muted small">
                    {m.ministries.map((mm) => data.ministries.find((x) => x.id === mm.ministryId)?.name).filter(Boolean).join(' · ') || 'Sem ministério'}
                  </span>
                  {m.interests?.some((i) => i.roles.length) && (
                    <span className="small interest-line">Interesse: {m.interests.flatMap((i) => i.roles).join(', ')}</span>
                  )}
                </div>
                <ChevronRight size={18} className="muted" />
              </button>
            )
          })}
        </div>
      )}
      <button className="btn btn-primary btn-block mt" onClick={() => push({ name: 'person' })}><UserPlus size={18} /> Cadastrar pessoa</button>
    </div>
  )
}

/** Cadastro / edição de uma pessoa */
export function PersonForm({ id }: { id?: string }) {
  const { data, actions, notify } = useStore()
  const me = useMe()
  const { back } = useNav()
  const existing = id ? data.members.find((m) => m.id === id) : undefined

  const [name, setName] = useState(existing?.name ?? '')
  const [phone, setPhone] = useState(existing ? formatPhone(existing.phone) : '')
  const [admin, setAdmin] = useState(existing?.access === 'admin')
  const [mins, setMins] = useState<MemberInput['ministries']>(() =>
    (existing?.ministries ?? []).map((mm) => ({
      ministryId: mm.ministryId,
      roles: mm.roles,
      leader: data.ministries.find((x) => x.id === mm.ministryId)?.leaderIds.includes(existing!.id) ?? false,
    })),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)

  const initials = initialsOf(name)
  const isSelf = existing?.id === me.id
  const selected = (mid: string) => mins.find((m) => m.ministryId === mid)
  const toggleMinistry = (mid: string) =>
    setMins((s) => (selected(mid) ? s.filter((m) => m.ministryId !== mid) : [...s, { ministryId: mid, roles: [], leader: false }]))
  const update = (mid: string, fn: (m: MemberInput['ministries'][number]) => MemberInput['ministries'][number]) =>
    setMins((s) => s.map((m) => (m.ministryId === mid ? fn(m) : m)))

  const missingRoles = mins.filter((m) => m.roles.length === 0 && !m.leader)
  const canSave = name.trim().split(/\s+/).length >= 2 && isValidPhone(phone) && !saving

  const save = async () => {
    setSaving(true)
    setError('')
    const r = await actions.saveMember({ id: existing?.id, name, phone, admin, ministries: mins })
    setSaving(false)
    if (!r.ok) return setError(r.error)
    notify(existing ? 'Cadastro atualizado' : `${name.trim().split(' ')[0]} cadastrado(a). Iniciais para entrar: ${spaced(initials)}`)
    back()
  }

  const remove = async () => {
    if (!existing) return
    setSaving(true)
    const r = await actions.removeMember(existing.id)
    setSaving(false)
    if (!r.ok) return setError(r.error)
    notify(`${existing.name} foi removido(a)`)
    back()
  }

  return (
    <div className="screen">
      <TopBar title={existing ? 'Editar pessoa' : 'Nova pessoa'} onBack={back} />

      <div className="card form-card">
        <label className="field">
          <span>Nome completo</span>
          <input id="person-name" autoComplete="off" autoCapitalize="words" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: João Victor da Silva" />
        </label>
        <label className="field">
          <span>Celular com DDD</span>
          <input id="person-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone((p) => nextPhoneValue(p, e.target.value))} placeholder="(16) 99999-9999" />
        </label>
        {initials.length >= 2 && (
          <div className="initials-preview">
            <span>Iniciais para entrar no app</span>
            <b>{spaced(initials)}</b>
          </div>
        )}
      </div>

      {existing?.interests?.some((i) => i.roles.length) && (
        <div className="card interest-card mt">
          <strong>Tem interesse em participar</strong>
          {existing.interests.filter((i) => i.roles.length).map((i) => (
            <span key={i.ministryId} className="small">{data.ministries.find((m) => m.id === i.ministryId)?.name}: {i.roles.join(', ')}</span>
          ))}
          <span className="muted small">Informado no formulário de cadastro{existing.createdAt ? ` em ${new Date(existing.createdAt).toLocaleDateString('pt-BR')}` : ''}.</span>
        </div>
      )}

      <h3 className="form-title">Ministérios</h3>
      <p className="muted small form-help">Marque os ministérios em que a pessoa serve, as funções que exerce e se é líder.</p>
      <div className="list">
        {data.ministries.map((m) => {
          const sel = selected(m.id)
          return (
            <div key={m.id} className={`card ministry-pick${sel ? ' on' : ''}`}>
              <button className="ministry-pick-head" onClick={() => toggleMinistry(m.id)} aria-pressed={!!sel}>
                <MinistryBadge ministry={m} size={32} />
                <strong className="grow">{m.name}</strong>
                <span className={`check${sel ? ' on' : ''}`}>{sel && <Check size={16} />}</span>
              </button>
              {sel && (
                <div className="ministry-pick-body">
                  <span className="field-label">Funções</span>
                  <div className="chips">
                    {m.roles.map((r) => {
                      const on = sel.roles.includes(r.name)
                      return (
                        <button key={r.name} className={`chip${on ? ' on' : ''}`}
                          onClick={() => update(m.id, (x) => ({ ...x, roles: on ? x.roles.filter((y) => y !== r.name) : [...x.roles, r.name] }))}>
                          {r.name}
                        </button>
                      )
                    })}
                  </div>
                  <label className="switch-row">
                    <span>Líder do ministério</span>
                    <input type="checkbox" checked={sel.leader} onChange={(e) => update(m.id, (x) => ({ ...x, leader: e.target.checked }))} />
                  </label>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="card form-card mt">
        <label className="switch-row">
          <span><ShieldCheck size={18} /> Administrador <span className="muted small block">Pode cadastrar e editar pessoas</span></span>
          <input type="checkbox" checked={admin} disabled={isSelf} onChange={(e) => setAdmin(e.target.checked)} />
        </label>
      </div>

      {missingRoles.length > 0 && (
        <p className="warn-box">Sem função marcada em {missingRoles.map((x) => data.ministries.find((m) => m.id === x.ministryId)?.name).join(', ')}: a pessoa não entra na escala desse ministério.</p>
      )}
      {error && <p className="error mt">{error}</p>}

      <button className="btn btn-primary btn-block mt" disabled={!canSave} onClick={save}>
        {saving ? 'Salvando…' : existing ? 'Salvar alterações' : 'Cadastrar pessoa'}
      </button>

      {existing && !isSelf && (
        confirmRemove ? (
          <div className="card confirm-box mt">
            <p>Remover <b>{existing.name}</b>? As escalas futuras dessa pessoa serão apagadas.</p>
            <div className="btn-row">
              <button className="btn btn-ghost" onClick={() => setConfirmRemove(false)}>Cancelar</button>
              <button className="btn btn-danger" disabled={saving} onClick={remove}>Remover</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-ghost btn-block mt danger-text" onClick={() => setConfirmRemove(true)}><Trash2 size={18} /> Remover pessoa</button>
        )
      )}
    </div>
  )
}
