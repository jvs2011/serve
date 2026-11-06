import { describe, expect, it } from 'vitest'
import { MOST_PLAYED, REPERTOIRE, songKey } from '../src/data/repertoire'

describe('repertório', () => {
  it('tem as 232 músicas (145 novas + 87 que já estavam na playlist), sem repetir', () => {
    expect(REPERTOIRE).toHaveLength(232)
    expect(new Set(REPERTOIRE.map(songKey)).size).toBe(232)
  })
  it('as mais tocadas estão no repertório', () => {
    const all = new Set(REPERTOIRE.map(songKey))
    expect(MOST_PLAYED.filter((t) => !all.has(songKey(t)))).toEqual([])
  })
})
