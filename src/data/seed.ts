import type { AppData, Assignment, ChurchEvent, Member, Ministry, Song, WeeklySlot } from './types.js'
import { addDays, toISO, fromISO, todayISO } from '../lib/dates.js'
import { autoFill } from '../lib/schedule.js'
import { DEFAULT_WEEKLY, eventId, weeklyEvents } from './agenda.js'
import { NEWS_SESSION_ROLES } from './sessions.js'

/** Versão do formato dos dados. Mude para forçar recriação dos dados de exemplo. */
export const DATA_VERSION = 22

/*
 * Ministérios da Lagoinha Franca.
 * As funções (roles) e vagas por evento são uma sugestão inicial — ajuste com cada líder.
 * `people` é só para gerar voluntários de exemplo suficientes para o rodízio.
 */
type MinistrySeed = Omit<Ministry, 'roles' | 'leaderIds'> & { roles: { name: string; count: number; people: number; group?: boolean; hint?: string; delivery?: string }[] }

const ministrySeeds: MinistrySeed[] = [
  {
    id: 'louvor', name: 'Louvor', color: '#E57A47', icon: 'music',
    description: 'Conduz a congregação na adoração a Deus por meio da música e da arte, com ensaios, treinamentos e eventos especiais.',
    roles: [
      // "Voz" é ocupada por um grupo de voz inteiro (o líder monta os grupos na aba Grupos)
      { name: 'Voz', count: 1, people: 9, group: true, hint: 'grupo de voz' },
      { name: 'Teclado', count: 1, people: 3 }, { name: 'Violão', count: 1, people: 3 }, { name: 'Guitarra', count: 1, people: 3 },
      { name: 'Baixo', count: 1, people: 3 }, { name: 'Bateria', count: 1, people: 3 }, { name: 'Mesa de som', count: 1, people: 3 },
    ],
  },
  {
    id: 'follow', name: 'Follow', color: '#7C6CF2', icon: 'megaphone',
    description: 'Ministério de Comunicação',
    roles: [
      // Fotografia e Vídeo enviam o material depois do culto (o link fica na escala)
      { name: 'Fotografia', count: 1, people: 3, delivery: 'as fotos' }, { name: 'Vídeo', count: 1, people: 3, delivery: 'o vídeo' },
      { name: 'Stories', count: 1, people: 3 }, { name: 'Projeção', count: 1, people: 3 }, { name: 'Transmissão', count: 1, people: 3 },
      // sem vaga nos cultos (count 0): o Lagoinha News tem gravação agendada pelo líder (filmagem + quem grava)
      // e a edição vai por pedido; artes vão pela aba Artes; site sem escala
      { name: 'Filmagem (News)', count: 0, people: 3, delivery: 'as filmagens' },
      { name: 'Gravação (News)', count: 0, people: 3 },
      { name: 'Edição do News', count: 0, people: 2 },
      { name: 'Edição de artes', count: 0, people: 3 },
      { name: 'Gestão do site', count: 0, people: 2 },
    ],
  },
  {
    id: 'diaconato', name: 'Diaconato', color: '#2F7FC1', icon: 'hand',
    description: 'Homens e mulheres com o coração voltado ao serviço ao próximo e à organização do culto.',
    roles: [
      { name: 'Portaria', count: 2, people: 6 }, { name: 'Acolhimento', count: 2, people: 6 },
      { name: 'Auditório', count: 2, people: 6 },
    ],
  },
  {
    id: 'centurioes', name: 'Centuriões', color: '#8B5E3C', icon: 'shield',
    description: 'Cuida da segurança da parte externa do templo durante os cultos.',
    roles: [
      { name: 'Estacionamento', count: 1, people: 4 },
    ],
  },
  {
    id: 'kids', name: 'KIDS', color: '#D98E04', icon: 'baby',
    description: 'Ministério de crianças: um ambiente seguro e acolhedor para as crianças crescerem na fé.',
    roles: [
      { name: 'Berçário', count: 1, people: 2, hint: '0 a 3 anos' },
      { name: 'Professor', count: 2, people: 4, hint: '4 a 10 anos' }, { name: 'Auxiliar', count: 2, people: 4, hint: '4 a 10 anos' },
      { name: 'Check-in Kids', count: 1, people: 2, hint: '4 a 10 anos' },
    ],
  },
  {
    id: 'intercessao', name: 'Intercessão', color: '#B0476C', icon: 'heart',
    description: 'Busca a presença de Deus em oração, intercedendo pela igreja, pela cidade, pelo país e pelo mundo.',
    roles: [{ name: 'Intercessor', count: 2, people: 6 }],
  },
  {
    id: 'consolidacao', name: 'Consolidação', color: '#8A5CD6', icon: 'userplus',
    description: 'Acompanha os novos convertidos, ajudando-os a crescer na fé e no conhecimento da Palavra.',
    roles: [{ name: 'Consolidador', count: 2, people: 6 }],
  },
  {
    id: 'dna', name: 'DNA', color: '#C2418F', icon: 'footprints',
    description: 'Ministério de dança: expressa a fé cristã por meio da arte da dança nas celebrações e eventos.',
    roles: [{ name: 'Dança', count: 4, people: 6 }],
  },
  {
    id: 'legacy', name: 'Legacy', color: '#E0533D', icon: 'flame',
    description: 'Ministério de Jovens: prepara os jovens para uma vida de discipulado e serviço a Deus.',
    roles: [{ name: 'Recepção', count: 2, people: 4 }, { name: 'Mídia', count: 1, people: 2 }, { name: 'Projeção', count: 1, people: 2 }],
  },
  {
    id: 'rocket', name: 'Rocket', color: '#F08A24', icon: 'rocket',
    description: 'Ministério de adolescentes: amizade, diversão e aprendizado sobre os valores cristãos.',
    roles: [{ name: 'Projeção', count: 1, people: 2 }, { name: 'Mídia', count: 1, people: 2 }],
  },
  {
    id: 'link', name: 'Link', color: '#18A999', icon: 'link',
    description: 'Ministério de pré-adolescentes: valores cristãos de forma lúdica e interativa.',
    roles: [{ name: 'Professor', count: 2, people: 4 }, { name: 'Auxiliar', count: 2, people: 4 }],
  },
  {
    id: 'shine', name: 'Shine', color: '#D94F8A', icon: 'sparkles',
    description: 'Ministério de mulheres: comunhão e crescimento espiritual para mulheres de todas as idades.',
    roles: [{ name: 'Organização', count: 1, people: 3, hint: 'curso' }],
  },
  {
    id: 'geracoes', name: 'Gerações', color: '#3E9B5B', icon: 'house',
    description: 'Ministério da família: fortalece os laços familiares em atividades para todas as idades.',
    roles: [{ name: 'Recepção', count: 2, people: 3 }, { name: 'Apoio', count: 2, people: 3 }],
  },
  {
    id: 'crie', name: 'CRIE', color: '#4A5A70', icon: 'briefcase',
    description: 'Ministério de cristãos empreendedores: rede de network, troca de experiências e novas ideias.',
    roles: [{ name: 'Recepção', count: 1, people: 2 }, { name: 'Organização', count: 2, people: 3 }],
  },
  {
    id: 'wecare', name: 'We Care', color: '#2BA36B', icon: 'handheart',
    description: 'Ministério de ação social: amor ao próximo em ações concretas que impactam a comunidade.',
    roles: [{ name: 'Triagem', count: 1, people: 2 }, { name: 'Voluntário de ação', count: 4, people: 6 }],
  },
  {
    id: 'carisma', name: 'Carisma', color: '#5468D4', icon: 'book',
    description: 'Classes Start, Deep e Go: estudo bíblico para aprofundamento e crescimento espiritual.',
    roles: [{ name: 'Secretário', count: 1, people: 1, hint: 'líder do Carisma' }, { name: 'Professor', count: 2, people: 4 }],
  },
]

// Nomes fictícios para os voluntários de exemplo
const FIRST = ['Gabriel', 'Júlia', 'Pedro', 'Larissa', 'Rafael', 'Camila', 'Thiago', 'Beatriz', 'Bruno', 'Letícia', 'Felipe', 'Isabela', 'Matheus', 'Carolina', 'Vinícius', 'Fernanda', 'Gustavo', 'Patrícia', 'Rodrigo', 'Juliana', 'Eduardo', 'Renata', 'Daniel', 'Aline', 'Leonardo', 'Débora', 'Ricardo', 'Priscila', 'Marcos', 'Tatiane', 'Paulo', 'Natália', 'Roberto', 'Vanessa', 'André', 'Helena', 'Caio', 'Márcia', 'Lucas', 'Cláudia', 'Samuel', 'Sandra', 'Davi', 'Raquel', 'Henrique', 'Sabrina', 'João', 'Lívia', 'Igor', 'Bianca', 'Otávio', 'Elaine', 'Diego', 'Rebeca', 'Arthur', 'Talita', 'Murilo', 'Ester', 'Fábio', 'Lorena']
const LAST = ['Souza', 'Martins', 'Henrique', 'Mendes', 'Lima', 'Duarte', 'Alves', 'Nunes', 'Carvalho', 'Ramos', 'Rocha', 'Freitas', 'Oliveira', 'Vieira', 'Barros', 'Lopes', 'Pires', 'Gomes', 'Teixeira', 'Castro', 'Santos', 'Faria', 'Moreira', 'Moura', 'Cardoso', 'Cunha', 'Azevedo', 'Araújo', 'Pereira', 'Rezende', 'Dias', 'Borges', 'Silva', 'Campos', 'Batista', 'Monteiro', 'Melo', 'Prado', 'Queiroz', 'Tavares']

function buildPeople() {
  const members: Member[] = [
    { id: 'm-lucas', name: 'Lucas Andrade', access: 'admin', maxPerMonth: 4, phone: '', ministries: [{ ministryId: 'follow', roles: ['Transmissão'] }] },
    { id: 'm-mariana', name: 'Mariana Costa', access: 'leader', maxPerMonth: 6, phone: '', ministries: [{ ministryId: 'louvor', roles: ['Voz'] }] },
    { id: 'm-ana', name: 'Ana Ribeiro', access: 'volunteer', maxPerMonth: 4, phone: '', ministries: [{ ministryId: 'louvor', roles: ['Voz'] }, { ministryId: 'diaconato', roles: ['Acolhimento'] }] },
    { id: 'm-rafaela', name: 'Rafaela Lopes', access: 'leader', maxPerMonth: 4, phone: '', ministries: [{ ministryId: 'follow', roles: ['Stories', 'Gravação (News)'] }] },
    // perfis da demonstração do Follow (primeira equipe a usar o app)
    { id: 'm-bruno', name: 'Bruno Almeida', access: 'volunteer', maxPerMonth: 4, phone: '', ministries: [{ ministryId: 'follow', roles: ['Projeção'] }] },
    { id: 'm-julia', name: 'Júlia Sampaio', access: 'volunteer', maxPerMonth: 4, phone: '', ministries: [{ ministryId: 'follow', roles: ['Edição de artes', 'Stories'] }] },
    { id: 'm-davi', name: 'Davi Moraes', access: 'volunteer', maxPerMonth: 4, phone: '', ministries: [{ ministryId: 'follow', roles: ['Filmagem (News)', 'Edição do News', 'Vídeo'] }] },
  ]
  const used = new Set(members.map((m) => m.name))
  let n = 0
  // FIRST alterna nomes masculinos (índice par) e femininos (ímpar)
  const nextName = (female = false) => {
    for (;;) {
      const i = n++
      if (female && i % FIRST.length % 2 === 0) continue
      const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7 + Math.floor(i / FIRST.length)) % LAST.length]}`
      if (!used.has(name)) { used.add(name); return name }
    }
  }
  const leaders: Record<string, string[]> = { louvor: ['m-mariana'], follow: ['m-rafaela'] }
  let idx = 0
  for (const ms of ministrySeeds) {
    for (const role of ms.roles) {
      // a Mariana e a Ana já ocupam vagas no Louvor
      let people = role.people
      if (ms.id === 'louvor' && role.name === 'Voz') people -= 2
      for (let i = 0; i < people; i++) {
        const name = nextName(ms.id === 'shine')
        const m: Member = {
          id: `m-${++idx}`, name, maxPerMonth: idx % 5 === 0 ? 3 : 6, phone: '',
          access: 'volunteer', ministries: [{ ministryId: ms.id, roles: [role.name] }],
        }
        if (!leaders[ms.id]) { leaders[ms.id] = [m.id]; m.access = 'leader' }
        members.push(m)
      }
    }
  }
  // alguns voluntários servem em dois ministérios (para o alerta de conflito aparecer)
  const cross: [string, string, string][] = [['follow', 'legacy', 'Mídia'], ['diaconato', 'geracoes', 'Recepção'], ['louvor', 'legacy', 'Recepção'], ['kids', 'link', 'Auxiliar']]
  for (const [from, to, role] of cross) {
    members.filter((m) => m.ministries[0]?.ministryId === from && m.access === 'volunteer').slice(0, 2)
      .forEach((m) => m.ministries.push({ ministryId: to, roles: [role] }))
  }
  members.forEach((m, i) => {
    m.phone = `(16) 9${String(8100 + i * 37).padStart(4, '0')}-${String(1000 + i * 211).slice(-4)}`
  })
  const ministries: Ministry[] = ministrySeeds.map((ms) => ({
    ...ms, leaderIds: leaders[ms.id] ?? [], roles: ms.roles.map(({ people: _p, ...r }) => r),
  }))
  return { members, ministries }
}

export const { members, ministries } = buildPeople()

/** Membros sugeridos na tela de entrada (modo demonstração) */
export const demoProfiles = [
  { id: 'm-rafaela', label: 'Líder do Follow', hint: 'monta a escala, pede artes e agenda o News' },
  { id: 'm-bruno', label: 'Projeção', hint: 'confirma escalas, pede e assume trocas' },
  { id: 'm-julia', label: 'Edição de artes', hint: 'recebe pedidos de arte e entrega pelo app' },
  { id: 'm-davi', label: 'Lagoinha News', hint: 'filma a gravação, edita o vídeo e envia o material' },
]

const setlists: Song[][] = [
  [
    { id: 's1', title: 'Bondade de Deus', artist: 'Isaías Saad', key: 'G' },
    { id: 's2', title: 'Grandes Coisas', artist: 'Fernandinho', key: 'A' },
    { id: 's3', title: 'Caminho no Deserto', artist: 'Soraya Moraes', key: 'D' },
    { id: 's4', title: 'Lindo És', artist: 'Livres', key: 'E' },
  ],
  [
    { id: 's5', title: 'Ousado Amor', artist: 'Isaías Saad', key: 'C' },
    { id: 's6', title: 'Aleluia', artist: 'Gabriela Rocha', key: 'B' },
    { id: 's7', title: 'Te Louvarei', artist: 'Toque no Altar', key: 'G' },
  ],
]

// PRNG determinístico para os dados de exemplo ficarem estáveis
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

/**
 * Agenda da igreja entre duas datas (YYYY-MM-DD, inclusivas): cultos fixos (da agenda fixa
 * `weekly`) e eventos especiais. Os ids são estáveis (data + horário + título), então
 * gerar de novo o mesmo período não duplica eventos.
 */
export function buildAgenda(fromDate: string, toDate: string, weekly: WeeklySlot[] = DEFAULT_WEEKLY): ChurchEvent[] {
  const events: ChurchEvent[] = weeklyEvents(weekly, fromDate, toDate)
  const ev = (d: Date, title: string, time: string, ministryIds: string[], extra: Partial<ChurchEvent> = {}) => {
    const iso = toISO(d)
    events.push({ id: eventId(iso, time, title), title, date: iso, time, ministryIds, setlist: [], ...extra })
  }

  /*
   * Eventos especiais (calendário de novembro e dezembro de 2026).
   * Sem ministérios = sem escala de voluntários.
   */
  const at = (iso: string) => fromISO(iso)
  const S = { special: true }
  ev(at('2026-11-14'), 'Reunião Follow', '15:00', [], { ...S, place: 'Templo', activity: 'Reunião', responsible: 'Follow' })
  ev(at('2026-11-20'), 'Shine Day', '', ['shine'], { ...S, allDay: true, place: 'Chácara', activity: 'Feriado' })
  ev(at('2026-11-20'), 'Acampamento Link', '', ['link'], { ...S, endDate: '2026-11-22', activity: 'Acampamento (sexta a domingo)' })
  ev(at('2026-11-21'), 'Formatura 2º semestre Bem Casados', '20:00', ['kids'], { ...S, responsible: 'Equipe Bem Casados', activity: 'Com apoio do KIDS' })
  ev(at('2026-11-25'), 'MAX GC', '20:00', [], S)
  ev(at('2026-12-18'), 'Reunião Líderes Ministérios', '20:00', [], { ...S, activity: 'Reunião' })
  // eventos especiais dentro dos cultos fixos
  for (const e of events) {
    if (e.date === '2026-12-13' && e.time === '09:30') Object.assign(e, { title: `${e.title} – Batismo`, special: true, activity: 'Batismo' })
    if (e.date === '2026-12-20' && (e.time === '09:30' || e.time === '18:30')) Object.assign(e, { title: 'Culto de Ações de Graças', special: true })
  }

  return events
    .filter((e) => e.date >= fromDate && e.date <= toDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
}

/** Ministérios da igreja, sem líderes (para começar os dados reais) */
export function ministryList(): Ministry[] {
  return ministrySeeds.map((ms) => ({ ...ms, leaderIds: [], roles: ms.roles.map(({ people: _p, ...r }) => r) }))
}

export function createSeed(): AppData {
  const rand = rng(42)
  const today = fromISO(todayISO())
  const events = buildAgenda(toISO(addDays(today, -14)), toISO(addDays(today, 49)))

  // repertório nos próximos cultos com Louvor
  let li = 0
  for (const e of events.filter((e) => e.date >= todayISO() && e.ministryIds.includes('louvor')).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4)) {
    e.setlist = setlists[li++ % setlists.length].map((s) => ({ ...s, id: `${s.id}-${e.id}` }))
  }

  const data: AppData = {
    version: DATA_VERSION,
    // cópias: cada demonstração começa dos mesmos dados, sem mexer nos originais
    ministries: structuredClone(ministries),
    members: structuredClone(members),
    events: [],
    assignments: [],
    unavailability: {},
    swaps: [],
    notices: [],
  }
  data.events = events
  data.weekly = structuredClone(DEFAULT_WEEKLY)
  data.generatedUntil = toISO(addDays(today, 49))

  // algumas indisponibilidades futuras
  const future = data.events.filter((e) => e.date > todayISO())
  for (const m of members) {
    if (rand() < 0.3) data.unavailability[m.id] = [future[Math.floor(rand() * future.length)].date]
  }

  // grupos de voz do Louvor (exemplo): 3 grupos com quem canta
  const voices = members.filter((m) => m.ministries.some((mm) => mm.ministryId === 'louvor' && mm.roles.includes('Voz')))
  const louvor = data.ministries.find((m) => m.id === 'louvor')!
  louvor.groups = [0, 1, 2].map((g) => ({
    id: `g${g + 1}`, name: `Grupo ${['Ágape', 'Shalom', 'Hosana'][g]}`,
    memberIds: voices.filter((_, i) => i % 3 === g).map((m) => m.id),
  }))

  // escalas geradas automaticamente: passado (até hoje) + próximas 2 semanas
  const horizon = toISO(addDays(today, 14))
  for (const e of data.events.filter((e) => e.date <= horizon)) {
    for (const mid of e.ministryIds) {
      const past = e.date < todayISO()
      for (const a of autoFill(data, e.id, mid, past ? 'confirmed' : 'pending')) {
        if (past) {
          a.checkedIn = rand() < 0.85
          if (a.checkedIn && rand() < 0.4) a.feedback = { rating: rand() < 0.7 ? 5 : 4, comment: '' }
        } else if (rand() < 0.55) {
          a.status = 'confirmed'
        }
        data.assignments.push(a)
      }
    }
  }

  const evById = new Map(data.events.map((e) => [e.id, e]))

  // Ana (perfil de demonstração): confirmada em quase tudo, com uma escala pendente
  const anaNext = data.assignments
    .filter((a) => a.memberId === 'm-ana')
    .map((a) => ({ a, e: evById.get(a.eventId)! }))
    .filter((x) => x.e.date >= todayISO())
    .sort((x, y) => x.e.date.localeCompare(y.e.date))
  anaNext.forEach((x) => (x.a.status = 'confirmed'))
  const firstLater = anaNext.find((x) => x.e.date > todayISO())
  if (firstLater) firstLater.a.status = 'pending'

  // pedidos de troca abertos (de colegas com a mesma função da Ana, para ela poder assumir)
  const now = new Date()
  const openSwap = (ministryId: string, role: string, reason: string, hoursAgo: number) => {
    const a = data.assignments.find((x) =>
      x.ministryId === ministryId && x.role === role && x.memberId !== 'm-ana' && x.memberId !== 'm-mariana' &&
      x.status !== 'declined' && (evById.get(x.eventId)?.date ?? '') > todayISO() &&
      !data.swaps.some((s) => s.fromMemberId === x.memberId))
    if (a) {
      data.swaps.push({
        id: `sw-${a.id}`, assignmentId: a.id, fromMemberId: a.memberId, reason,
        createdAt: new Date(now.getTime() - hoursAgo * 3600_000).toISOString(), status: 'open',
      })
    }
  }
  openSwap('louvor', 'Voz', 'Vou viajar com a família nesse fim de semana 🙏', 5)
  openSwap('diaconato', 'Acolhimento', 'Plantão no trabalho, não consigo chegar a tempo.', 26)
  openSwap('louvor', 'Bateria', 'Prova na faculdade no dia seguinte.', 50)

  const leaderOf = (id: string) => ministries.find((m) => m.id === id)?.leaderIds[0] ?? 'm-lucas'
  data.notices = [
    {
      id: 'n1', ministryId: null, authorId: 'm-lucas', title: 'Bem-vindos ao Serve! 🧡',
      body: 'A partir de agora as escalas dos ministérios da Lagoinha Franca ficam aqui. Confirme sua presença e marque suas indisponibilidades com antecedência.',
      createdAt: new Date(now.getTime() - 3 * 3600_000).toISOString(),
    },
    {
      id: 'n2', ministryId: 'louvor', authorId: 'm-mariana', title: 'Repertório de domingo no app',
      body: 'O repertório dos próximos cultos já está no app, estudem os tons! Sexta tem Sala de Adoração na Garagem às 20h.',
      createdAt: new Date(now.getTime() - 20 * 3600_000).toISOString(),
    },
    {
      id: 'n3', ministryId: 'diaconato', authorId: leaderOf('diaconato'), title: 'Chegada 40 minutos antes',
      body: 'Equipe do Diaconato: chegada 40 min antes do culto para a oração e alinhamento. Usem o crachá.',
      createdAt: new Date(now.getTime() - 30 * 3600_000).toISOString(),
    },
    {
      id: 'n4', ministryId: 'kids', authorId: leaderOf('kids'), title: 'Material da aula de domingo',
      body: 'A lição deste mês é sobre Davi. Material na sala KIDS, armário 2.',
      createdAt: new Date(now.getTime() - 48 * 3600_000).toISOString(),
    },
    {
      id: 'n5', ministryId: 'follow', authorId: leaderOf('follow'), title: 'Cobertura dos cultos de domingo',
      body: 'Domingo tem Culto de Ceia: precisamos de fotos e stories nos dois horários. Confiram se estão escalados.',
      createdAt: new Date(now.getTime() - 60 * 3600_000).toISOString(),
    },
  ]

  // artes do Follow (exemplos): duas para a Júlia (uma já entregue) e uma atrasada de outra pessoa
  const artists = members.filter((m) => m.id !== 'm-julia' && m.ministries.some((mm) => mm.ministryId === 'follow' && mm.roles.includes('Edição de artes')))
  const upcoming = data.events.filter((e) => e.date > todayISO() && e.ministryIds.includes('follow') && e.slotId)
  const dd = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  const e1 = upcoming[0], e2 = upcoming.find((e) => e.date > (e1?.date ?? '')) ?? upcoming[1]
  data.tasks = []
  if (e1) data.tasks.push({
    id: 't1', ministryId: 'follow', title: `Arte · ${e1.title} (${dd(e1.date)})`, eventId: e1.id,
    details: 'Feed e stories. Usar a foto do último batismo e o texto “Venha celebrar com a gente”.',
    assigneeId: 'm-julia', dueDate: toISO(addDays(today, 2)), status: 'open', createdBy: 'm-rafaela', createdAt: new Date(now.getTime() - 86_400_000).toISOString(),
    social: true,
  })
  if (e2 && artists[0]) data.tasks.push({
    id: 't2', ministryId: 'follow', title: `Arte · ${e2.title} (${dd(e2.date)})`, eventId: e2.id, details: 'Versão para a projeção (16:9).',
    assigneeId: artists[0].id, dueDate: toISO(addDays(today, -1)), status: 'open', createdBy: 'm-rafaela', createdAt: new Date(now.getTime() - 3 * 86_400_000).toISOString(),
    projection: true,
  })
  data.tasks.push({
    id: 't3', ministryId: 'follow', title: 'Arte · Reunião Follow', details: 'Convite para os stories.', assigneeId: 'm-julia', social: true,
    dueDate: toISO(addDays(today, -3)), status: 'done', link: 'https://www.canva.com/', createdBy: 'm-rafaela',
    createdAt: new Date(now.getTime() - 6 * 86_400_000).toISOString(), doneAt: new Date(now.getTime() - 4 * 86_400_000).toISOString(),
  })

  // rascunho da escala dos 2 cultos seguintes, esperando a líder publicar (Follow e Louvor)
  for (const e of data.events.filter((e) => e.date > horizon && e.ministryIds.includes('follow') && e.ministryIds.length > 1).slice(0, 2)) {
    for (const mid of ['follow', 'louvor']) for (const a of autoFill(data, e.id, mid)) data.assignments.push({ ...a, draft: true })
  }

  // Follow: gravação do Lagoinha News com a equipe convidada (alguns já responderam)
  const newsDay = toISO(addDays(today, 4))
  const newsRole = (m: Member) => NEWS_SESSION_ROLES.find((r) => m.ministries.some((mm) => mm.ministryId === 'follow' && mm.roles.includes(r)))
  const newsTeam = data.members.filter((m) => newsRole(m))
  data.events.push({
    id: 'e-demo-news', title: 'Gravação Lagoinha News', date: newsDay, time: '19:30', ministryIds: ['follow'], setlist: [],
    activity: 'Gravação · episódio de dezembro', place: 'Garagem', slots: NEWS_SESSION_ROLES.map((role) => ({ ministryId: 'follow', role, count: Math.max(1, newsTeam.filter((m) => newsRole(m) === role).length) })),
  })
  newsTeam.forEach((m, i) => data.assignments.push({
    id: `a-news-${i}`, eventId: 'e-demo-news', ministryId: 'follow', role: newsRole(m)!, memberId: m.id,
    status: m.id === 'm-rafaela' ? 'confirmed' : i % 3 === 1 ? 'declined' : i % 3 === 2 ? 'confirmed' : 'pending',
  }))

  // We Care: ação externa criada pelo líder, com parte da equipe escalada
  const care = toISO(addDays(today, 9))
  data.events.push({
    id: 'e-demo-wecare', title: 'Ação no Lar São Vicente', date: care, time: '09:00', endTime: '12:00', ministryIds: ['wecare'], setlist: [],
    special: true, place: 'Lar São Vicente de Paulo', activity: 'Evento externo',
    slots: [{ ministryId: 'wecare', role: 'Triagem', count: 1 }, { ministryId: 'wecare', role: 'Voluntário de ação', count: 6 }],
  })
  for (const a of autoFill(data, 'e-demo-wecare', 'wecare').slice(0, 4)) data.assignments.push({ ...a, status: rand() < 0.5 ? 'confirmed' : 'pending' })
  data.events.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

  // perfis do Follow: escalas nos próximos cultos (a primeira esperando resposta) e uma troca para o Bruno assumir
  const nextOf = (role: string) => data.assignments
    .filter((a) => a.ministryId === 'follow' && a.role === role && !a.draft && a.status !== 'declined' && (evById.get(a.eventId)?.date ?? '') > todayISO())
    .sort((x, y) => evById.get(x.eventId)!.date.localeCompare(evById.get(y.eventId)!.date))
  const give = (memberId: string, role: string, n: number, firstPending = true) =>
    nextOf(role).filter((a) => !data.assignments.some((b) => b.eventId === a.eventId && b.memberId === memberId)).slice(0, n)
      .forEach((a, i) => { a.memberId = memberId; a.status = i === 0 && firstPending ? 'pending' : 'confirmed'; delete a.checkedIn })
  give('m-bruno', 'Projeção', 3)
  give('m-julia', 'Stories', 2, false)
  give('m-davi', 'Vídeo', 2, false)
  const davi = data.assignments.find((a) => a.eventId === 'e-demo-news' && a.memberId === 'm-davi')
  if (davi) davi.status = 'pending'
  const other = nextOf('Projeção').find((a) => a.memberId !== 'm-bruno' && !data.assignments.some((b) => b.eventId === a.eventId && b.memberId === 'm-bruno'))
  // projeção: no próximo culto do Bruno já tem a arte e o vídeo do News entregues (e o repertório do Louvor)
  const brunoNext = nextOf('Projeção').find((a) => a.memberId === 'm-bruno')
  const projEv = brunoNext && evById.get(brunoNext.eventId)
  if (projEv) {
    const ago = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString()
    data.tasks!.push(
      { id: 't-proj-arte', ministryId: 'follow', title: `Arte · ${projEv.title} (${dd(projEv.date)})`, eventId: projEv.id, details: 'Abertura do culto, 16:9.',
        assigneeId: 'm-julia', dueDate: toISO(addDays(fromISO(projEv.date), -2)), status: 'done', link: 'https://www.canva.com/', projection: true,
        createdBy: 'm-rafaela', createdAt: ago(72), doneAt: ago(20) },
    )
    if (projEv.ministryIds.includes('louvor') && projEv.setlist.length) projEv.setlistSentAt = ago(26)
  }
  // material dos cultos que já passaram: quase tudo enviado; o Davi ainda deve o vídeo do último culto em que serviu
  const deliverable = (a: Assignment) => data.ministries.find((m) => m.id === a.ministryId)?.roles.find((r) => r.name === a.role)?.delivery
  const pastVideo = data.assignments
    .filter((a) => a.ministryId === 'follow' && a.role === 'Vídeo' && (evById.get(a.eventId)?.date ?? '9') < todayISO() && a.status !== 'declined')
    .sort((x, y) => evById.get(y.eventId)!.date.localeCompare(evById.get(x.eventId)!.date))
    .find((a) => !data.assignments.some((b) => b.eventId === a.eventId && b.memberId === 'm-davi'))
  if (pastVideo) Object.assign(pastVideo, { memberId: 'm-davi', status: 'confirmed', checkedIn: true })
  for (const a of data.assignments) {
    const date = evById.get(a.eventId)?.date ?? ''
    if (!date || date >= todayISO() || !deliverable(a) || a.status === 'declined' || a === pastVideo) continue
    if (rand() < 0.8) a.delivery = { link: a.role === 'Vídeo' ? 'https://www.youtube.com/' : 'https://drive.google.com/', at: new Date(fromISO(date).getTime() + 30 * 3600_000).toISOString() }
  }

  // vídeo do News: passa nos dois cultos de domingo. O deste domingo já foi entregue (o Bruno está na Projeção da manhã);
  // o do domingo seguinte o Davi ainda está editando
  const sundays = [...new Set(data.events.filter((e) => e.slotId && e.date > todayISO() && fromISO(e.date).getDay() === 0 && e.ministryIds.includes('follow')).map((e) => e.date))].sort()
  const [sun1, sun2] = sundays
  if (sun1) {
    const morning = data.events.filter((e) => e.date === sun1 && e.slotId && e.ministryIds.includes('follow')).sort((a, b) => a.time.localeCompare(b.time))[0]
    const proj = morning && data.assignments.find((a) => a.eventId === morning.id && a.ministryId === 'follow' && a.role === 'Projeção' && !a.draft)
    if (proj && !data.assignments.some((b) => b.eventId === morning.id && b.memberId === 'm-bruno')) Object.assign(proj, { memberId: 'm-bruno', status: 'confirmed' })
    data.tasks!.push({ id: 't-proj-news', ministryId: 'follow', kind: 'news', title: `Vídeo do News · domingo ${dd(sun1)}`, airDate: sun1, details: 'Episódio da semana, 3 minutos.',
      assigneeId: 'm-davi', dueDate: toISO(addDays(fromISO(sun1), -1)), status: 'done', link: 'https://www.youtube.com/', projection: true,
      createdBy: 'm-rafaela', createdAt: new Date(now.getTime() - 96 * 3600_000).toISOString(), doneAt: new Date(now.getTime() - 6 * 3600_000).toISOString() })
  }
  if (sun2) data.tasks!.push({ id: 't-news-2', ministryId: 'follow', kind: 'news', title: `Vídeo do News · domingo ${dd(sun2)}`, airDate: sun2,
    details: 'Gravação de sábado. Até 3 minutos.', assigneeId: 'm-davi', dueDate: toISO(addDays(fromISO(sun2), -1)), status: 'open', projection: true,
    createdBy: 'm-rafaela', createdAt: new Date(now.getTime() - 5 * 3600_000).toISOString() })

  if (other) {
    other.status = 'confirmed'
    data.swaps.unshift({ id: 'sw-projecao', assignmentId: other.id, fromMemberId: other.memberId, reason: 'Vou estar viajando nesse fim de semana 🙏', createdAt: new Date(now.getTime() - 3 * 3600_000).toISOString(), status: 'open' })
  }

  return data
}

/** Função que o líder ocupa no ministério (ex.: Secretário do Carisma) */
export const LEADER_ROLES: Record<string, string> = { carisma: 'Secretário' }

/**
 * Funções que mudaram de nome ou saíram: usado para atualizar os dados reais.
 * null = a função deixou de existir (sai do cadastro das pessoas).
 */

export const ROLE_RENAMES: Record<string, Record<string, string | string[] | null>> = {
  louvor: { Ministro: 'Voz', Vocal: 'Voz' },
  centurioes: { 'Portão': 'Estacionamento', 'Ronda externa': 'Estacionamento' },
  shine: { 'Recepção': 'Organização', Apoio: 'Organização' },
  // o Lagoinha News virou duas funções no dia da gravação (a Edição do News é nova): quem era do News fica nas duas
  follow: { 'Lagoinha News': ['Filmagem (News)', 'Gravação (News)'] },
}
