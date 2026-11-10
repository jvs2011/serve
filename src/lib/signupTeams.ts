/*
 * Como as equipes aparecem no formulário público de cadastro (/cadastro/<ministério>):
 * agrupadas, com um nome curto e uma linha explicando o que a equipe faz.
 * O valor enviado continua sendo o nome da função no app (ex.: "Filmmaker (News)").
 */

export interface SignupTeam { name: string; label: string; desc?: string }
export interface SignupSection { title?: string; teams: SignupTeam[] }

type Layout = { title: string; teams: [name: string, label: string, desc: string][] }[]

const LAYOUTS: Record<string, Layout> = {
  follow: [
    { title: 'Nos cultos', teams: [
      ['Fotografia', 'Fotografia', 'fotografa o culto e envia as fotos'],
      ['Filmmaker', 'Filmmaker', 'filma o culto e envia o vídeo'],
      ['Stories', 'Stories', 'posta os stories do culto'],
      ['Projeção', 'Projeção', 'letras, artes e vídeos na projeção'],
      ['Transmissão', 'Transmissão', 'transmite o culto ao vivo'],
    ] },
    { title: 'Lagoinha News', teams: [
      ['Filmmaker (News)', 'Filmmaker', 'filma a gravação do News'],
      ['Apresentação (News)', 'Apresentação', 'apresenta o News na gravação'],
      ['Edição do News', 'Edição', 'edita o vídeo do News'],
    ] },
    { title: 'Edição e site', teams: [
      ['Edição de fotos', 'Edição de fotos', 'trata as fotos do culto e dos eventos'],
      ['Edição de vídeos', 'Edição de vídeos', 'edita os vídeos para a projeção e as redes'],
      ['Edição de artes', 'Edição de artes', 'artes para a projeção e as redes'],
      ['Gestão do site', 'Gestão do site', 'cuida do site da igreja'],
    ] },
  ],
}

/** As equipes do ministério em seções; as que não estão no layout vão numa seção final sem título */
export function signupSections(ministryId: string, teams: string[]): SignupSection[] {
  const layout = LAYOUTS[ministryId] ?? []
  const used = new Set<string>()
  const sections: SignupSection[] = layout.map((s) => ({
    title: s.title,
    teams: s.teams.filter(([name]) => teams.includes(name)).map(([name, label, desc]) => (used.add(name), { name, label, desc })),
  }))
  const rest = teams.filter((t) => !used.has(t)).map((name) => ({ name, label: name }))
  if (rest.length) sections.push({ title: sections.length ? 'Outras' : undefined, teams: rest })
  return sections.filter((s) => s.teams.length)
}
