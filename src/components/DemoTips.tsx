import { useState } from 'react'
import { ChevronRight, Lightbulb, X } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { useNav, type Route, type Tab } from '../nav'

interface Tip { text: string; go?: Tab | Route }

/** O que vale experimentar em cada perfil de demonstração */
const TIPS: Record<string, { title: string; tips: Tip[] }> = {
  'm-rafaela': {
    title: 'Você está como líder do Follow',
    tips: [
      { text: 'Confira o rascunho da escala e toque em Publicar' },
      { text: 'Peça uma arte e escolha o responsável', go: { name: 'ministry', id: 'follow', tab: 'arts' } },
      { text: 'Agende uma gravação do Lagoinha News', go: { name: 'ministry', id: 'follow' } },
      { text: 'Veja o painel com vagas, confirmações e presença', go: { name: 'dashboard' } },
    ],
  },
  'm-bruno': {
    title: 'Você está na Projeção',
    tips: [
      { text: 'Confirme a escala que está esperando sua resposta' },
      { text: 'Assuma a troca que um colega da Projeção pediu', go: 'swaps' },
      { text: 'Veja o repertório do próximo culto', go: 'agenda' },
      { text: 'Marque um culto em que você não pode servir', go: { name: 'availability' } },
    ],
  },
  'm-julia': {
    title: 'Você está na Edição de artes',
    tips: [
      { text: 'Abra a arte pedida e veja o prazo' },
      { text: 'Marque a arte como entregue com o link', go: { name: 'ministry', id: 'follow', tab: 'arts' } },
      { text: 'Veja suas escalas de Stories', go: 'agenda' },
    ],
  },
  'm-davi': {
    title: 'Você está no Lagoinha News',
    tips: [
      { text: 'Responda o convite da próxima gravação (Filmagem)' },
      { text: 'Entregue o vídeo editado do News', go: { name: 'ministry', id: 'follow', tab: 'arts' } },
      { text: 'Envie o vídeo do culto em que você serviu' },
    ],
  },
}

const KEY = 'serve:demo-tips-hidden'

export function DemoTips() {
  const { mode } = useStore()
  const me = useMe()
  const { push, setTab } = useNav()
  const [hidden, setHidden] = useState(() => {
    try { return (localStorage.getItem(KEY) ?? '').split(',').includes(me.id) } catch { return false }
  })
  const cfg = TIPS[me.id]
  if (mode !== 'demo' || !cfg || hidden) return null
  const hide = () => {
    try { localStorage.setItem(KEY, [...(localStorage.getItem(KEY) ?? '').split(','), me.id].filter(Boolean).join(',')) } catch { /* ignore */ }
    setHidden(true)
  }
  return (
    <div className="card demo-tips">
      <div className="demo-tips-head">
        <Lightbulb size={18} />
        <strong className="grow">{cfg.title}: experimente</strong>
        <button className="icon-btn sm" aria-label="Fechar sugestões" onClick={hide}><X size={16} /></button>
      </div>
      {cfg.tips.map((t) => t.go ? (
        <button key={t.text} className="demo-tip" onClick={() => (typeof t.go === 'string' ? setTab(t.go) : push(t.go!))}>
          <span className="grow">{t.text}</span><ChevronRight size={16} />
        </button>
      ) : (
        <div key={t.text} className="demo-tip static"><span className="grow">{t.text}</span></div>
      ))}
    </div>
  )
}
