import type { AppData, ChurchEvent, Member, Ministry, Song } from './types.js'
import { addDays, toISO, fromISO, todayISO } from '../lib/dates.js'
import { autoFill } from '../lib/schedule.js'

/** Versão do formato dos dados. Mude para forçar recriação dos dados de exemplo. */
export const DATA_VERSION = 14

/*
 * Ministérios da Lagoinha Franca.
 * As funções (roles) e vagas por evento são uma sugestão inicial — ajuste com cada líder.
 * `people` é só para gerar voluntários de exemplo suficientes para o rodízio.
 */
type MinistrySeed = Omit<Ministry, 'roles' | 'leaderIds'> & { roles: { name: string; count: number; people: number; group?: boolean; hint?: string }[] }

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
      { name: 'Fotografia', count: 1, people: 3 }, { name: 'Vídeo', count: 1, people: 3 }, { name: 'Stories', count: 1, people: 3 },
      { name: 'Projeção', count: 1, people: 3 }, { name: 'Transmissão', count: 1, people: 3 },
      // sem vaga nos cultos (count 0): News tem gravação agendada pelo líder; artes vão pela aba Artes; site sem escala
      { name: 'Lagoinha News', count: 0, people: 4 },
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
    roles: [{ name: 'Recepção', count: 2, people: 4 }, { name: 'Organização', count: 2, people: 4 }, { name: 'Mídia', count: 1, people: 2 }],
  },
  {
    id: 'rocket', name: 'Rocket', color: '#F08A24', icon: 'rocket',
    description: 'Ministério de adolescentes: amizade, diversão e aprendizado sobre os valores cristãos.',
    roles: [{ name: 'Líder de grupo', count: 2, people: 4 }, { name: 'Apoio', count: 2, people: 4 }],
  },
  {
    id: 'link', name: 'Link', color: '#18A999', icon: 'link',
    description: 'Ministério de pré-adolescentes: valores cristãos de forma lúdica e interativa.',
    roles: [{ name: 'Professor', count: 2, people: 4 }, { name: 'Auxiliar', count: 2, people: 4 }],
  },
  {
    id: 'shine', name: 'Shine', color: '#D94F8A', icon: 'sparkles',
    description: 'Ministério de mulheres: comunhão e crescimento espiritual para mulheres de todas as idades.',
    roles: [{ name: 'Recepção', count: 2, people: 3 }, { name: 'Apoio', count: 2, people: 3 }],
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
    roles: [{ name: 'Professor', count: 1, people: 3 }, { name: 'Apoio', count: 1, people: 2 }],
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
  const leaders: Record<string, string[]> = { louvor: ['m-mariana'] }
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
  { id: 'm-ana', label: 'Voluntária', hint: 'Louvor e Diaconato' },
  { id: 'm-mariana', label: 'Líder', hint: 'Ministério de Louvor' },
  { id: 'm-lucas', label: 'Coordenação', hint: 'Acesso a todos os ministérios' },
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

/** Próxima data (a partir de `from`) que cai no dia da semana `dow` (0 = domingo) */
function nextDow(from: Date, dow: number) {
  const d = new Date(from)
  while (d.getDay() !== dow) d.setDate(d.getDate() + 1)
  return d
}

/** Cultos e encontros fixos da semana (para a pessoa marcar os que não consegue servir) */
export interface RecurringSlot { key: string; day: string; time: string; title: string; ministryIds: string[] }
const TEMPLO = ['louvor', 'follow', 'diaconato', 'centurioes', 'intercessao', 'consolidacao']
export const RECURRING_SLOTS: RecurringSlot[] = [
  { key: '0-09:30', day: 'Domingo', time: '9h30', title: 'Culto da manhã', ministryIds: [...TEMPLO, 'kids'] },
  { key: '0-18:30', day: 'Domingo', time: '18h30', title: 'Culto da noite', ministryIds: [...TEMPLO, 'kids'] },
  { key: '3-20:00', day: 'Quarta', time: '20h', title: 'Culto Fé', ministryIds: [...TEMPLO, 'geracoes', 'carisma', 'shine'] },
  { key: '1-20:00', day: 'Segunda', time: '20h', title: 'Carisma', ministryIds: ['carisma'] },
  { key: '2-19:30', day: 'Terça', time: '19h30', title: 'Link (GC)', ministryIds: ['link'] },
  { key: '4-19:30', day: 'Quinta', time: '19h30', title: 'Shine', ministryIds: ['shine'] },
  { key: '5-20:00', day: 'Sexta', time: '20h', title: 'Sala de Adoração (quinzenal)', ministryIds: ['louvor'] },
  { key: '6-19:00', day: 'Sábado', time: '19h', title: 'Culto Rocket', ministryIds: ['rocket'] },
  { key: '6-19:30', day: 'Sábado', time: '19h30', title: 'Culto Legacy', ministryIds: ['legacy'] },
]

/**
 * Agenda da igreja entre duas datas (YYYY-MM-DD, inclusivas): cultos fixos, uso contínuo
 * dos espaços e eventos especiais. Os ids são estáveis (data + horário + título), então
 * gerar de novo o mesmo período não duplica eventos.
 */
export function buildAgenda(fromDate: string, toDate: string): ChurchEvent[] {
  const events: ChurchEvent[] = []
  const slug = (s: string) => s.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase()
  const ev = (d: Date, title: string, time: string, ministryIds: string[], extra: Partial<ChurchEvent> = {}) => {
    const iso = toISO(d)
    events.push({ id: `e-${iso}-${time.replace(':', '')}-${slug(title)}`, title, date: iso, time, ministryIds, setlist: [], ...extra })
  }

  /*
   * Agenda fixa da Lagoinha Franca
   * Cultos no templo: domingos 09:30 e 18:30, quartas 20:00 (o tema muda conforme a semana do mês).
   * Uso contínuo dos espaços: cursos, GCs, ensaios e cultos dos ministérios.
   */
  const templo = ['louvor', 'follow', 'diaconato', 'centurioes', 'intercessao', 'consolidacao']
  const domingo = [...templo, 'kids']
  const T = { place: 'Templo' }
  // ano de referência para a sexta quinzenal do Louvor (semanas alternadas)
  const fridayAnchor = nextDow(new Date(2026, 0, 1), 5).getTime()
  for (let d = fromISO(fromDate); toISO(d) <= toDate; d = addDays(d, 1)) {
    const nth = Math.ceil(d.getDate() / 7) // 1ª, 2ª… ocorrência do dia da semana no mês
    switch (d.getDay()) {
      case 0: // Domingo
        ev(d, nth === 2 ? 'Culto de Ceia' : 'Culto de Celebração', '09:30', domingo, T)
        ev(d, nth === 1 ? 'Culto de Ceia' : 'Culto de Celebração', '18:30', domingo, T)
        break
      case 1: // Segunda
        ev(d, 'Carisma', '20:00', ['carisma'], { endTime: '21:30', place: 'Templo e sala "Carisma"', activity: 'Curso' })
        ev(d, 'Restaurar Homem', '20:00', [], { endTime: '21:30', place: 'Sala "Na Mesa"', activity: 'Curso' })
        break
      case 2: // Terça
        ev(d, 'Link', '19:30', ['link'], { endTime: '21:00', place: 'Garagem', activity: 'GC' })
        break
      case 3: { // Quarta
        ev(d, 'Restaurar Mulher', '18:30', [], { endTime: '20:00', place: 'Sala "Na Mesa"', activity: 'Curso' })
        const shineMonth = [3, 6, 8].includes(d.getMonth()) // abril, julho e setembro
        if (nth === 1) ev(d, 'Culto Fé – Louvor e Clamor', '20:00', templo, T)
        else if (nth === 2) ev(d, 'Culto Fé', '20:00', templo, T)
        else if (nth === 3) ev(d, 'Culto Fé – Gerações', '20:00', [...templo, 'geracoes'], { ...T, responsible: 'Equipe Bem Casados' })
        else if (nth === 4) ev(d, 'Culto Fé – Carisma', '20:00', [...templo, 'carisma'], { ...T, responsible: 'Pr. Alexandre' })
        else if (shineMonth) ev(d, 'Culto Shine', '20:00', [...templo, 'shine'], { ...T, responsible: 'Ministério Shine' })
        else ev(d, 'Culto Fé', '20:00', templo, T)
        break
      }
      case 4: // Quinta
        ev(d, 'Shine', '19:30', ['shine'], { endTime: '21:30', place: 'Sala "Na Mesa"', activity: 'Curso Experiência do Lar' })
        break
      case 5: // Sexta (quinzenal)
        if (Math.round((d.getTime() - fridayAnchor) / 86_400_000 / 7) % 2 === 0) {
          ev(d, 'Sala de Adoração', '20:00', ['louvor'], { endTime: '21:30', place: 'Garagem', activity: 'Louvor' })
        }
        break
      case 6: // Sábado
        // DNA está parado por enquanto: o ensaio fica na agenda, sem escala
        ev(d, 'Ensaio DNA', '08:30', [], { endTime: '11:00', place: 'Templo', activity: 'Ensaio' })
        ev(d, 'Culto Rocket', '19:00', ['rocket'], { endTime: '20:00', place: 'Templo', activity: 'Culto' })
        ev(d, 'Culto Legacy', '19:30', ['legacy'], { endTime: '21:30', place: 'Prédio Kids', activity: 'Culto' })
        break
    }
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
    ministries,
    members,
    events: [],
    assignments: [],
    unavailability: {},
    swaps: [],
    notices: [],
  }
  data.events = events

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

  // artes do Follow (exemplos): uma para o Lucas, uma atrasada e uma entregue
  const artists = members.filter((m) => m.ministries.some((mm) => mm.ministryId === 'follow' && mm.roles.includes('Edição de artes')))
  const upcoming = data.events.filter((e) => e.date > todayISO() && e.ministryIds.includes('follow'))
  const dd = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  const e1 = upcoming[0], e2 = upcoming.find((e) => e.date > (e1?.date ?? '')) ?? upcoming[1]
  data.tasks = []
  if (e1) data.tasks.push({
    id: 't1', ministryId: 'follow', title: `Arte · ${e1.title} (${dd(e1.date)})`, eventId: e1.id,
    details: 'Feed e stories. Usar a foto do último batismo e o texto "Venha celebrar com a gente".',
    assigneeId: 'm-lucas', dueDate: toISO(addDays(today, 2)), status: 'open', createdBy: 'm-lucas', createdAt: new Date(now.getTime() - 86_400_000).toISOString(),
  })
  if (e2 && artists[0]) data.tasks.push({
    id: 't2', ministryId: 'follow', title: `Arte · ${e2.title} (${dd(e2.date)})`, eventId: e2.id, details: 'Versão para o telão (16:9).',
    assigneeId: artists[0].id, dueDate: toISO(addDays(today, -1)), status: 'open', createdBy: 'm-lucas', createdAt: new Date(now.getTime() - 3 * 86_400_000).toISOString(),
  })
  if (artists[1]) data.tasks.push({
    id: 't3', ministryId: 'follow', title: 'Arte · Reunião Follow', details: '', assigneeId: artists[1].id,
    dueDate: toISO(addDays(today, -3)), status: 'done', link: 'https://www.canva.com/', createdBy: 'm-lucas',
    createdAt: new Date(now.getTime() - 6 * 86_400_000).toISOString(), doneAt: new Date(now.getTime() - 4 * 86_400_000).toISOString(),
  })

  return data
}

/**
 * Funções que mudaram de nome ou saíram: usado para atualizar os dados reais.
 * null = a função deixou de existir (sai do cadastro das pessoas).
 */
export const ROLE_RENAMES: Record<string, Record<string, string | null>> = {
  louvor: { Ministro: 'Voz', Vocal: 'Voz' },
  centurioes: { 'Portão': 'Estacionamento', 'Ronda externa': 'Estacionamento' },
}
