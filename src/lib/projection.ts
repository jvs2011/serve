/*
 * Projeção: o que vai para a projeção em cada culto.
 * Junta o repertório do Louvor, as artes marcadas para a projeção e o vídeo do Lagoinha News,
 * para a equipe de Projeção encontrar tudo dentro da escala do dia.
 */
import type { AppData, ChurchEvent, Member, Song, Task } from '../data/types.js'
import { canManage, slotsFor } from './schedule.js'

export const PROJECTION_MINISTRY = 'follow'
export const PROJECTION_ROLE = 'Projeção'

export interface ProjectionMaterials {
  /** vídeos do News e artes para a projeção deste culto (o News primeiro) */
  tasks: Task[]
  /** repertório do Louvor */
  songs: Song[]
}

export function projectionMaterials(data: AppData, ev: ChurchEvent): ProjectionMaterials {
  const tasks = (data.tasks ?? [])
    .filter((t) => t.projection && t.eventId === ev.id)
    .sort((a, b) => Number(b.kind === 'news') - Number(a.kind === 'news') || a.title.localeCompare(b.title))
  return { tasks, songs: ev.ministryIds.includes('louvor') ? ev.setlist : [] }
}

/** O culto tem Projeção? (o Follow serve e há vaga de Projeção) */
export function hasProjection(data: AppData, ev: ChurchEvent): boolean {
  return ev.ministryIds.includes(PROJECTION_MINISTRY) && slotsFor(data, ev, PROJECTION_MINISTRY).some((r) => r.name === PROJECTION_ROLE && r.count > 0)
}

/** A pessoa vê o quadro da projeção neste culto? (Projeção do Follow, líderes do Follow e coordenação) */
export function seesProjection(data: AppData, me: Member, ev: ChurchEvent): boolean {
  if (!hasProjection(data, ev)) return false
  return canManage(me, PROJECTION_MINISTRY, data) ||
    me.ministries.some((mm) => mm.ministryId === PROJECTION_MINISTRY && mm.roles.includes(PROJECTION_ROLE))
}

/** Quem está escalado (publicado, sem recusa) na Projeção deste culto */
export function projectionTeam(data: AppData, eventId: string): string[] {
  return [...new Set(data.assignments
    .filter((a) => a.eventId === eventId && a.ministryId === PROJECTION_MINISTRY && a.role === PROJECTION_ROLE && !a.draft && a.status !== 'declined')
    .map((a) => a.memberId))]
}

/** Resumo curto: "4 músicas · 1 arte · vídeo do News" */
export function projectionSummary(m: ProjectionMaterials): string {
  const arts = m.tasks.filter((t) => !t.kind).length
  const videos = m.tasks.filter((t) => t.kind === 'video').length
  const news = m.tasks.some((t) => t.kind === 'news')
  return [
    m.songs.length && `${m.songs.length} ${m.songs.length === 1 ? 'música' : 'músicas'}`,
    arts && `${arts} ${arts === 1 ? 'arte' : 'artes'}`,
    videos && `${videos} ${videos === 1 ? 'vídeo' : 'vídeos'}`,
    news && 'vídeo do News',
  ].filter(Boolean).join(' · ')
}
