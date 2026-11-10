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
      { text: 'Faça um pedido de arte, vídeo, fotos ou News', go: { name: 'ministry', id: 'follow', tab: 'arts' } },
      { text: 'Veja quem já enviou fotos e vídeos dos últimos cultos', go: { name: 'ministry', id: 'follow' } },
      { text: 'Veja o painel com vagas, confirmações e presença', go: { name: 'dashboard' } },
    ],
  },
  'm-bruno': {
    title: 'Você está na Projeção',
    tips: [
      { text: 'Confirme a escala que está esperando sua resposta' },
      { text: 'Abra o culto e veja músicas, artes e o vídeo do News', go: 'agenda' },
      { text: 'Assuma a troca que um colega da Projeção pediu', go: 'swaps' },
    ],
  },
  'm-vitor': {
    title: 'Você está como Filmmaker',
    tips: [
      { text: 'Envie o vídeo do último culto (cartão logo abaixo)' },
      { text: 'Confirme sua próxima escala' },
      { text: 'Marque um culto em que você não pode servir', go: { name: 'availability' } },
    ],
  },
  'm-carol': {
    title: 'Você está na Fotografia',
    tips: [
      { text: 'Envie as fotos do último culto (cartão logo abaixo)' },
      { text: 'Confirme sua próxima escala' },
      { text: 'Peça troca de uma escala', go: 'agenda' },
    ],
  },
  'm-lara': {
    title: 'Você está na Edição de fotos',
    tips: [
      { text: 'Veja o pedido de fotos, com prazo e destino' },
      { text: 'Abra as fotos que a Fotografia enviou (Material para editar)' },
      { text: 'Entregue com o link do Drive', go: { name: 'ministry', id: 'follow', tab: 'arts' } },
    ],
  },
  'm-teo': {
    title: 'Você está na Edição de vídeos',
    tips: [
      { text: 'Veja o pedido de vídeo, com prazo e destino' },
      { text: 'Abra o vídeo que o Filmmaker enviou (Material para editar)' },
      { text: 'Entregue com o link do YouTube ou do Drive', go: { name: 'ministry', id: 'follow', tab: 'arts' } },
    ],
  },
  'm-julia': {
    title: 'Você está na Edição de artes',
    tips: [
      { text: 'Veja a arte pedida, com prazo e destino' },
      { text: 'Entregue com o link do Canva ou do Drive', go: { name: 'ministry', id: 'follow', tab: 'arts' } },
      { text: 'Veja as artes que você já entregou', go: { name: 'ministry', id: 'follow', tab: 'arts' } },
    ],
  },
  'm-gustavo': {
    title: 'Você está na Transmissão',
    tips: [
      { text: 'Confirme a escala que está esperando sua resposta' },
      { text: 'Assuma a troca que um colega da Transmissão pediu', go: 'swaps' },
      { text: 'Veja suas próximas escalas', go: 'agenda' },
    ],
  },
  'm-bianca': {
    title: 'Você está nos Stories',
    tips: [
      { text: 'Confirme sua próxima escala' },
      { text: 'Pegue as fotos de um culto no Histórico de serviço', go: { name: 'history' } },
      { text: 'Veja os avisos do Follow logo abaixo' },
    ],
  },
  'm-davi': {
    title: 'Você está como Filmmaker do News',
    tips: [
      { text: 'Responda o convite da próxima gravação' },
      { text: 'Envie as filmagens da última gravação (cartão logo abaixo)' },
    ],
  },
  'm-nina': {
    title: 'Você está na Edição do News',
    tips: [
      { text: 'Veja o vídeo do News que você precisa entregar' },
      { text: 'Veja as filmagens da última gravação (Material para editar)' },
      { text: 'Entregue o link: a Projeção dos dois cultos de domingo recebe', go: { name: 'ministry', id: 'follow', tab: 'arts' } },
    ],
  },
  'm-leo': {
    title: 'Você está na Apresentação do News',
    tips: [
      { text: 'Responda o convite da próxima gravação' },
      { text: 'Marque um dia em que você não pode gravar', go: { name: 'availability' } },
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
