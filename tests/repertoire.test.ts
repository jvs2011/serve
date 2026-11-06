import { describe, expect, it } from 'vitest'
import { ARTISTS, PLAY_COUNTS, REPERTOIRE, songKey } from '../src/data/repertoire'

describe('repertório', () => {
  it('tem as 234 músicas (lista da playlist + Lugar secreto e Algo novo da planilha), sem repetir', () => {
    expect(REPERTOIRE).toHaveLength(234)
    expect(new Set(REPERTOIRE.map(songKey)).size).toBe(234)
  })
  it('contagem e artistas só de músicas do repertório', () => {
    const all = new Set(REPERTOIRE)
    expect(Object.keys(PLAY_COUNTS).filter((t) => !all.has(t))).toEqual([])
    expect(Object.keys(ARTISTS).filter((t) => !all.has(t))).toEqual([])
  })
  it('as mais tocadas da planilha', () => {
    const top = Object.entries(PLAY_COUNTS).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t)
    expect(top).toEqual(['Gratidão', 'Teu amor não falha', 'Que se abram os céus'])
  })
})
