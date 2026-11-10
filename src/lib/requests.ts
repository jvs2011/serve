/*
 * Tipos de pedido do Follow (aba Artes): edição de arte, de vídeo (vídeos gerais), de fotos e do Lagoinha News.
 * Arte, vídeo e fotos vão para a projeção e/ou mídias sociais; o News vai só para a projeção.
 * Cada tipo vai primeiro para a sua equipe de edição.
 */
import type { Task } from '../data/types.js'

export type RequestKind = 'art' | 'video' | 'photo' | 'news'

export const kindOf = (t: Pick<Task, 'kind'>): RequestKind => t.kind ?? 'art'

/** Tipos guardados no pedido (a arte é o padrão, sem `kind`) */
export const isRequestKind = (k: unknown): k is Exclude<RequestKind, 'art'> => k === 'video' || k === 'photo' || k === 'news'

export const REQUEST_KINDS: Record<RequestKind, {
  /** nome no botão de escolha */
  chip: string
  /** começo do título ("Arte · Culto Fé (11/11)") */
  prefix: string
  /** "a arte", "o vídeo", "as fotos", "o vídeo do News" */
  the: string
  /** "da arte", "do vídeo", "das fotos" */
  of: string
  /** onde costuma estar o link entregue */
  linkHint: string
  /** funções que aparecem primeiro na lista de responsáveis (na ordem) */
  roles: string[]
  /** pode ir para as mídias sociais */
  social: boolean
  /** dias antes do culto para o prazo sugerido */
  leadDays: number
  /** botão de enviar o pedido */
  ask: string
  /** pergunta quando não é de um culto ("Qual arte?") */
  which: string
  /** exemplo no campo do nome */
  example: string
  /** exemplo no campo de detalhes */
  detailsHint: string
  /** avisos para quem recebe e para os líderes */
  newTitle: string
  doneTitle: string
  emoji: string
}> = {
  art: {
    chip: 'Edição de arte', prefix: 'Arte', the: 'a arte', of: 'da arte', linkHint: 'Drive, Canva, WeTransfer…', roles: ['Edição de artes'], social: true, leadDays: 2,
    ask: 'Pedir arte', which: 'Qual arte?', example: 'Ex.: Arte da Conferência de Jovens', detailsHint: 'Formato (feed, stories, projeção), textos, referências…',
    newTitle: 'Nova arte para você 🎨', doneTitle: 'Arte entregue ✅', emoji: '🎨',
  },
  // vídeos gerais: quem é da Edição de vídeos primeiro, depois o Filmmaker
  video: {
    chip: 'Edição de vídeo', prefix: 'Vídeo', the: 'o vídeo', of: 'do vídeo', linkHint: 'YouTube, Drive, WeTransfer…', roles: ['Edição de vídeos', 'Filmmaker'], social: true, leadDays: 2,
    ask: 'Pedir vídeo', which: 'Qual vídeo?', example: 'Ex.: Vídeo · Conferência de Jovens', detailsHint: 'Duração, formato, trechos, observações…',
    newTitle: 'Vídeo para editar 🎬', doneTitle: 'Vídeo entregue ✅', emoji: '🎬',
  },
  photo: {
    chip: 'Edição de fotos', prefix: 'Fotos', the: 'as fotos', of: 'das fotos', linkHint: 'Drive, WeTransfer…', roles: ['Edição de fotos', 'Fotografia'], social: true, leadDays: 2,
    ask: 'Pedir fotos', which: 'Quais fotos?', example: 'Ex.: Fotos · Batismo de domingo', detailsHint: 'Quantas fotos, formato (feed, stories), observações…',
    newTitle: 'Fotos para editar 📸', doneTitle: 'Fotos entregues ✅', emoji: '📸',
  },
  news: {
    chip: 'Edição do News', prefix: 'Vídeo do News', the: 'o vídeo do News', of: 'do vídeo do News', linkHint: 'YouTube, Drive, WeTransfer…', roles: ['Edição do News'], social: false, leadDays: 1,
    ask: 'Pedir vídeo do News', which: 'Qual vídeo?', example: 'Ex.: Vídeo do News · domingo 15/11', detailsHint: 'Duração, pauta, observações…',
    newTitle: 'Vídeo do News para editar 🎬', doneTitle: 'Vídeo do News entregue ✅', emoji: '🎬',
  },
}

/** "arte", "vídeo", "fotos" (sem o artigo) */
export const bareName = (k: RequestKind) => REQUEST_KINDS[k].the.replace(/^(as|os|a|o) /, '')

/** Troca o começo do título quando muda o tipo do pedido */
export function retitle(title: string, to: RequestKind): string {
  const from = (Object.values(REQUEST_KINDS).map((k) => k.prefix).sort((a, b) => b.length - a.length)).find((p) => title.startsWith(`${p} · `))
  return from ? `${REQUEST_KINDS[to].prefix} · ${title.slice(from.length + 3)}` : title
}
