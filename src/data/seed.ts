import type { AppData, ChurchEvent, Member, Ministry, Song } from './types'
import { addDays, toISO, fromISO, todayISO } from '../lib/dates'
import { autoFill } from '../lib/schedule'

/** Versão do formato dos dados. Mude para forçar recriação dos dados de exemplo. */
export const DATA_VERSION = 4

export const ministries: Ministry[] = [
  {
    id: 'louvor', name: 'Louvor', color: '#E57A47', icon: 'music',
    description: 'Ministração musical nos cultos e eventos.',
    leaderIds: ['m-mariana'],
    roles: [
      { name: 'Ministro', count: 1 }, { name: 'Vocal', count: 2 }, { name: 'Violão', count: 1 },
      { name: 'Teclado', count: 1 }, { name: 'Guitarra', count: 1 }, { name: 'Baixo', count: 1 }, { name: 'Bateria', count: 1 },
    ],
  },
  {
    id: 'midia', name: 'Mídia', color: '#7C6CF2', icon: 'camera',
    description: 'Fotos, stories, projeção e transmissão ao vivo.',
    leaderIds: ['m-leticia'],
    roles: [{ name: 'Fotografia', count: 1 }, { name: 'Stories', count: 1 }, { name: 'Projeção', count: 1 }, { name: 'Transmissão', count: 1 }],
  },
  {
    id: 'tecnica', name: 'Som & Luz', color: '#2FA8E0', icon: 'sliders',
    description: 'Mesa de som, iluminação e suporte técnico.',
    leaderIds: ['m-eduardo'],
    roles: [{ name: 'Mesa de som', count: 1 }, { name: 'Iluminação', count: 1 }],
  },
  {
    id: 'recepcao', name: 'Recepção', color: '#22B07D', icon: 'door',
    description: 'Acolher cada pessoa que chega na Lagoinha Franca.',
    leaderIds: ['m-patricia'],
    roles: [{ name: 'Porta principal', count: 2 }, { name: 'Acolhimento', count: 2 }, { name: 'Estacionamento', count: 1 }],
  },
  {
    id: 'kids', name: 'Lagoinha Kids', color: '#F2B53A', icon: 'baby',
    description: 'Cuidado e ensino das crianças durante os cultos.',
    leaderIds: ['m-aline'],
    roles: [{ name: 'Professor', count: 2 }, { name: 'Auxiliar', count: 2 }, { name: 'Check-in Kids', count: 1 }],
  },
  {
    id: 'intercessao', name: 'Intercessão', color: '#E2558B', icon: 'heart',
    description: 'Oração antes e durante os cultos.',
    leaderIds: ['m-helena'],
    roles: [{ name: 'Intercessor', count: 2 }],
  },
]

type MemberSeed = [id: string, name: string, access: Member['access'], max: number, ministries: [string, string[]][]]

const memberSeeds: MemberSeed[] = [
  ['m-lucas', 'Lucas Andrade', 'admin', 4, [['tecnica', ['Iluminação']]]],
  ['m-mariana', 'Mariana Costa', 'leader', 6, [['louvor', ['Ministro', 'Vocal']]]],
  ['m-ana', 'Ana Ribeiro', 'volunteer', 4, [['louvor', ['Vocal']], ['recepcao', ['Acolhimento', 'Porta principal']]]],
  ['m-gabriel', 'Gabriel Souza', 'volunteer', 6, [['louvor', ['Ministro', 'Violão']]]],
  ['m-julia', 'Júlia Martins', 'volunteer', 5, [['louvor', ['Vocal']]]],
  ['m-pedro', 'Pedro Henrique', 'volunteer', 6, [['louvor', ['Teclado']]]],
  ['m-rafael', 'Rafael Lima', 'volunteer', 6, [['louvor', ['Guitarra']], ['tecnica', ['Mesa de som']]]],
  ['m-thiago', 'Thiago Alves', 'volunteer', 6, [['louvor', ['Baixo']]]],
  ['m-bruno', 'Bruno Carvalho', 'volunteer', 6, [['louvor', ['Bateria']]]],
  ['m-larissa', 'Larissa Mendes', 'volunteer', 5, [['louvor', ['Vocal', 'Ministro']]]],
  ['m-felipe', 'Felipe Rocha', 'volunteer', 6, [['louvor', ['Bateria', 'Violão']]]],
  ['m-camila', 'Camila Duarte', 'volunteer', 6, [['louvor', ['Teclado', 'Vocal']]]],
  ['m-matheus', 'Matheus Oliveira', 'volunteer', 6, [['louvor', ['Guitarra', 'Baixo']]]],
  ['m-isabela', 'Isabela Freitas', 'volunteer', 5, [['louvor', ['Vocal']], ['kids', ['Auxiliar']]]],
  ['m-leticia', 'Letícia Ramos', 'leader', 6, [['midia', ['Stories', 'Fotografia']]]],
  ['m-vinicius', 'Vinícius Barros', 'volunteer', 6, [['midia', ['Fotografia']]]],
  ['m-beatriz', 'Beatriz Nunes', 'volunteer', 6, [['midia', ['Stories']]]],
  ['m-gustavo', 'Gustavo Pires', 'volunteer', 6, [['midia', ['Projeção', 'Transmissão']]]],
  ['m-rodrigo', 'Rodrigo Teixeira', 'volunteer', 6, [['midia', ['Transmissão']]]],
  ['m-carolina', 'Carolina Vieira', 'volunteer', 6, [['midia', ['Projeção']]]],
  ['m-eduardo', 'Eduardo Santos', 'leader', 6, [['tecnica', ['Mesa de som']]]],
  ['m-daniel', 'Daniel Moreira', 'volunteer', 6, [['tecnica', ['Mesa de som', 'Iluminação']]]],
  ['m-leonardo', 'Leonardo Cardoso', 'volunteer', 6, [['tecnica', ['Iluminação']]]],
  ['m-patricia', 'Patrícia Gomes', 'leader', 6, [['recepcao', ['Acolhimento']]]],
  ['m-fernanda', 'Fernanda Lopes', 'volunteer', 6, [['recepcao', ['Porta principal']]]],
  ['m-ricardo', 'Ricardo Azevedo', 'volunteer', 6, [['recepcao', ['Estacionamento', 'Porta principal']]]],
  ['m-sandra', 'Sandra Melo', 'volunteer', 6, [['recepcao', ['Acolhimento']], ['intercessao', ['Intercessor']]]],
  ['m-marcos', 'Marcos Pereira', 'volunteer', 6, [['recepcao', ['Estacionamento']]]],
  ['m-juliana', 'Juliana Castro', 'volunteer', 6, [['recepcao', ['Porta principal', 'Acolhimento']]]],
  ['m-paulo', 'Paulo Henrique Dias', 'volunteer', 6, [['recepcao', ['Estacionamento']]]],
  ['m-renata', 'Renata Faria', 'volunteer', 6, [['recepcao', ['Porta principal']]]],
  ['m-aline', 'Aline Moura', 'leader', 6, [['kids', ['Professor']]]],
  ['m-debora', 'Débora Cunha', 'volunteer', 6, [['kids', ['Professor']]]],
  ['m-priscila', 'Priscila Araújo', 'volunteer', 6, [['kids', ['Auxiliar']]]],
  ['m-tatiane', 'Tatiane Rezende', 'volunteer', 6, [['kids', ['Auxiliar', 'Check-in Kids']]]],
  ['m-natalia', 'Natália Borges', 'volunteer', 6, [['kids', ['Professor', 'Auxiliar']]]],
  ['m-vanessa', 'Vanessa Campos', 'volunteer', 6, [['kids', ['Check-in Kids', 'Auxiliar']]]],
  ['m-helena', 'Helena Batista', 'leader', 8, [['intercessao', ['Intercessor']]]],
  ['m-marcia', 'Márcia Andrade', 'volunteer', 8, [['intercessao', ['Intercessor']]]],
  ['m-roberto', 'Roberto Silva', 'volunteer', 6, [['intercessao', ['Intercessor']]]],
  ['m-claudia', 'Cláudia Monteiro', 'volunteer', 6, [['intercessao', ['Intercessor']]]],
]

export const members: Member[] = memberSeeds.map(([id, name, access, maxPerMonth, ms], i) => ({
  id, name, access, maxPerMonth,
  phone: `(16) 9${String(9100 + i * 37).padStart(4, '0')}-${String(1000 + i * 211).slice(-4)}`,
  ministries: ms.map(([ministryId, roles]) => ({ ministryId, roles })),
}))

/** Membros sugeridos na tela de entrada (modo demonstração) */
export const demoProfiles = [
  { id: 'm-ana', label: 'Voluntária', hint: 'Louvor e Recepção' },
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

export function createSeed(): AppData {
  const rand = rng(42)
  const today = fromISO(todayISO())
  const events: ChurchEvent[] = []
  const all = ministries.map((m) => m.id)
  const midweek = ['louvor', 'midia', 'tecnica', 'recepcao', 'intercessao']
  let li = 0
  for (let i = -14; i <= 49; i++) {
    const d = addDays(today, i)
    const iso = toISO(d)
    const dow = d.getDay()
    if (dow === 3) events.push({ id: `e-${iso}-20`, title: 'Culto de Quarta', date: iso, time: '20:00', ministryIds: midweek, setlist: [] })
    if (dow === 0) {
      events.push({ id: `e-${iso}-10`, title: 'Culto da Família', date: iso, time: '10:00', ministryIds: all, setlist: [] })
      events.push({ id: `e-${iso}-18`, title: 'Culto de Celebração', date: iso, time: '18:00', ministryIds: all, setlist: [] })
    }
  }
  // repertório nos próximos cultos
  for (const ev of events.filter((e) => e.date >= todayISO()).slice(0, 4)) {
    ev.setlist = setlists[li++ % setlists.length].map((s) => ({ ...s, id: `${s.id}-${ev.id}` }))
  }

  const data: AppData = {
    version: DATA_VERSION,
    ministries,
    members,
    events,
    assignments: [],
    unavailability: {},
    swaps: [],
    notices: [],
  }

  // algumas indisponibilidades futuras
  for (const m of members) {
    if (rand() < 0.35) {
      const future = events.filter((e) => e.date > todayISO())
      const ev = future[Math.floor(rand() * future.length)]
      data.unavailability[m.id] = [ev.date]
    }
  }

  // escalas geradas automaticamente: passado (até hoje) + próximas 2 semanas
  const horizon = toISO(addDays(today, 14))
  for (const ev of events.filter((e) => e.date <= horizon)) {
    for (const mid of ev.ministryIds) {
      const past = ev.date < todayISO()
      const created = autoFill(data, ev.id, mid, past ? 'confirmed' : 'pending')
      for (const a of created) {
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

  // Ana (perfil de demonstração): confirmada em quase tudo, com uma escala pendente
  // logo à frente para mostrar a confirmação (e check-in, se servir hoje)
  const anaNext = data.assignments
    .filter((a) => a.memberId === 'm-ana')
    .map((a) => ({ a, ev: events.find((e) => e.id === a.eventId)! }))
    .filter((x) => x.ev.date >= todayISO())
    .sort((x, y) => x.ev.date.localeCompare(y.ev.date))
  anaNext.forEach((x) => (x.a.status = 'confirmed'))
  const firstLater = anaNext.find((x) => x.ev.date > todayISO())
  if (firstLater) firstLater.a.status = 'pending'

  // pedidos de troca abertos
  const now = new Date()
  const openSwapFor = (memberId: string, reason: string, hoursAgo: number) => {
    const a = data.assignments
      .filter((x) => x.memberId === memberId && x.status !== 'declined')
      .find((x) => (events.find((e) => e.id === x.eventId)?.date ?? '') > todayISO())
    if (a) {
      data.swaps.push({
        id: `sw-${memberId}`, assignmentId: a.id, fromMemberId: memberId, reason,
        createdAt: new Date(now.getTime() - hoursAgo * 3600_000).toISOString(), status: 'open',
      })
    }
  }
  openSwapFor('m-julia', 'Vou viajar com a família nesse fim de semana 🙏', 5)
  openSwapFor('m-fernanda', 'Plantão no trabalho, não consigo chegar a tempo.', 26)
  openSwapFor('m-thiago', 'Prova na faculdade no dia seguinte.', 50)

  data.notices = [
    {
      id: 'n1', ministryId: null, authorId: 'm-lucas', title: 'Bem-vindos ao Serve! 🧡',
      body: 'A partir de agora todas as escalas dos ministérios da Lagoinha Franca ficam aqui. Confirme sua presença e marque suas indisponibilidades com antecedência.',
      createdAt: new Date(now.getTime() - 3 * 3600_000).toISOString(),
    },
    {
      id: 'n2', ministryId: 'louvor', authorId: 'm-mariana', title: 'Ensaio geral no sábado',
      body: 'Sábado às 15h no templo. Repertório já está no app, estudem os tons!',
      createdAt: new Date(now.getTime() - 20 * 3600_000).toISOString(),
    },
    {
      id: 'n3', ministryId: 'kids', authorId: 'm-aline', title: 'Material da aula de domingo',
      body: 'A lição deste mês é sobre Davi. Material na sala Kids, armário 2.',
      createdAt: new Date(now.getTime() - 48 * 3600_000).toISOString(),
    },
    {
      id: 'n4', ministryId: 'recepcao', authorId: 'm-patricia', title: 'Novo uniforme',
      body: 'Usem a camiseta laranja da Recepção a partir deste domingo. Chegada 40 min antes do culto.',
      createdAt: new Date(now.getTime() - 72 * 3600_000).toISOString(),
    },
  ]

  return data
}
