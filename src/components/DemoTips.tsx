import { useState } from 'react'
import { ChevronRight, Lightbulb, X } from 'lucide-react'
import { useMe, useStore } from '../data/store'
import { useNav, type Route, type Tab } from '../nav'

interface Tip { text: string; go?: Tab | Route }

/** O que vale experimentar em cada perfil de demonstração */
const TIPS: Record<string, { title: string; tips: Tip[] }> = {
  'm-ana': {
    title: 'Você está como voluntária',
    tips: [
      { text: 'Confirme a escala que está esperando sua resposta' },
      { text: 'Assuma o pedido de troca de um colega', go: 'swaps' },
      { text: 'Marque um culto em que você não pode servir', go: { name: 'availability' } },
      { text: 'Veja o repertório e a cifra do próximo culto', go: 'agenda' },
    ],
  },
  'm-mariana': {
    title: 'Você está como líder do Louvor',
    tips: [
      { text: 'Confira o rascunho da escala e toque em Publicar' },
      { text: 'Monte ou edite um grupo de voz', go: { name: 'ministry', id: 'louvor', tab: 'groups' } },
      { text: 'Gere a escala automática dos próximos 30 dias', go: { name: 'ministry', id: 'louvor' } },
      { text: 'Mande um aviso para a equipe', go: { name: 'ministry', id: 'louvor', tab: 'notices' } },
    ],
  },
  'm-rafaela': {
    title: 'Você está como líder do Follow',
    tips: [
      { text: 'Peça uma arte e escolha o responsável', go: { name: 'ministry', id: 'follow', tab: 'arts' } },
      { text: 'Agende uma gravação do Lagoinha News', go: { name: 'ministry', id: 'follow' } },
      { text: 'Veja quem já confirmou a próxima gravação', go: 'agenda' },
    ],
  },
  'm-lucas': {
    title: 'Você está como coordenação',
    tips: [
      { text: 'Veja o painel com vagas, presença e quem precisa de cuidado', go: { name: 'dashboard' } },
      { text: 'Acompanhe todas as trocas da igreja', go: 'swaps' },
      { text: 'Veja a ação externa do We Care', go: { name: 'ministry', id: 'wecare' } },
      { text: 'Cadastre uma pessoa', go: { name: 'people' } },
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
