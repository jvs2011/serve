import { useMemo, useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import { useStore } from '../data/store'
import { MOST_PLAYED, REPERTOIRE, songKey } from '../data/repertoire'
import type { ChurchEvent, Song } from '../data/types'

interface Entry { title: string; artist: string; key: string; link?: string; times: number; k: string }

/** Músicas que já tocamos: as do app (com artista, tom e link) + o repertório da igreja. Um toque adiciona. */
export function SongLibrary({ ev, onPick }: { ev: ChurchEvent; onPick: (s: Omit<Song, 'id'>) => void }) {
  const { data } = useStore()
  const [q, setQ] = useState('')

  const entries = useMemo(() => {
    const map = new Map<string, Entry>()
    // repertório da igreja
    for (const title of REPERTOIRE) map.set(songKey(title), { title, artist: '', key: '—', times: 0, k: songKey(title) })
    // o que já foi colocado no app, do mais antigo ao mais recente (fica o artista/tom/link mais recente)
    const played = [...data.events].filter((e) => e.id !== ev.id && e.setlist.length).sort((a, b) => a.date.localeCompare(b.date))
    for (const e of played) {
      for (const s of e.setlist) {
        const k = songKey(s.title)
        const cur = map.get(k)
        map.set(k, {
          title: cur?.title ?? s.title, k,
          artist: s.artist || cur?.artist || '', key: s.key && s.key !== '—' ? s.key : cur?.key ?? '—',
          link: s.link ?? cur?.link, times: (cur?.times ?? 0) + 1,
        })
      }
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
  }, [data.events, ev.id])

  const inSetlist = new Set(ev.setlist.map((s) => songKey(s.title)))
  const term = songKey(q)
  const filtered = term ? entries.filter((e) => e.k.includes(term) || songKey(e.artist).includes(term)) : entries
  const top = useMemo(() => {
    const byKey = new Map(entries.map((e) => [e.k, e]))
    const picks = [...MOST_PLAYED.map((t) => byKey.get(songKey(t))), ...[...entries].filter((e) => e.times >= 2).sort((a, b) => b.times - a.times)]
    return [...new Map(picks.filter((e): e is Entry => !!e).map((e) => [e.k, e])).values()].slice(0, 16)
  }, [entries])

  const row = (e: Entry) => {
    const has = inSetlist.has(e.k)
    const info = [e.artist, e.key !== '—' && `tom ${e.key}`, e.times > 0 && `${e.times}× no app`].filter(Boolean).join(' · ')
    return (
      <button key={e.k} className={`song-pick${has ? ' has' : ''}`} disabled={has}
        onClick={() => onPick({ title: e.title, artist: e.artist, key: e.key, ...(e.link ? { link: e.link } : {}) })}>
        <span className="grow">
          <strong>{e.title}</strong>
          {(info || has) && <span className="muted small">{has ? 'Já está no repertório' : info}</span>}
        </span>
        {has ? <Check size={18} /> : <Plus size={18} />}
      </button>
    )
  }

  // lista completa com a letra inicial separando os grupos
  let letter = ''
  return (
    <div className="song-library">
      <label className="search">
        <Search size={18} />
        <input id="song-search" placeholder={`Buscar entre ${entries.length} músicas`} value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {term ? (
        filtered.length ? <div className="song-list">{filtered.map(row)}</div>
          : <p className="muted small center">Nenhuma música com “{q}”. Volte e digite o nome para adicionar.</p>
      ) : (
        <>
          <span className="field-label">Mais tocadas</span>
          <div className="song-list">{top.map(row)}</div>
          <span className="field-label mt">Todas as músicas ({entries.length})</span>
          <div className="song-list">
            {entries.map((e) => {
              const l = e.title.normalize('NFD')[0].toUpperCase()
              const head = l !== letter ? <span key={`l-${l}`} className="song-letter">{(letter = l)}</span> : null
              return [head, row(e)]
            })}
          </div>
        </>
      )}
    </div>
  )
}
