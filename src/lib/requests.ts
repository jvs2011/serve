/*
 * Tipos de pedido do Follow (aba Artes): edição de arte, de vídeo (vídeos gerais) e do Lagoinha News.
 * Arte e vídeo vão para a projeção e/ou mídias sociais; o News vai só para a projeção.
 */
import type { Task } from '../data/types.js'

export type RequestKind = 'art' | 'video' | 'news'

export const kindOf = (t: Pick<Task, 'kind'>): RequestKind => t.kind ?? 'art'

export const REQUEST_KINDS: Record<RequestKind, {
  /** nome no botão de escolha */
  chip: string
  /** começo do título ("Arte · Culto Fé (11/11)") */
  prefix: string
  /** "a arte", "o vídeo", "o vídeo do News" */
  the: string
  /** funções que aparecem primeiro na lista de responsáveis (na ordem) */
  roles: string[]
  /** pode ir para as mídias sociais */
  social: boolean
  /** dias antes do culto para o prazo sugerido */
  leadDays: number
}> = {
  art: { chip: 'Edição de arte', prefix: 'Arte', the: 'a arte', roles: ['Edição de artes'], social: true, leadDays: 2 },
  // vídeos gerais: quem edita (artes e vídeos) primeiro, depois quem filma
  video: { chip: 'Edição de vídeo', prefix: 'Vídeo', the: 'o vídeo', roles: ['Edição de artes', 'Vídeo'], social: true, leadDays: 2 },
  news: { chip: 'Edição do News', prefix: 'Vídeo do News', the: 'o vídeo do News', roles: ['Edição do News'], social: false, leadDays: 1 },
}

/** Troca o começo do título quando muda o tipo do pedido */
export function retitle(title: string, to: RequestKind): string {
  const from = (Object.values(REQUEST_KINDS).map((k) => k.prefix).sort((a, b) => b.length - a.length)).find((p) => title.startsWith(`${p} · `))
  return from ? `${REQUEST_KINDS[to].prefix} · ${title.slice(from.length + 3)}` : title
}
