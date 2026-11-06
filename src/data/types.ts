export type Access = 'admin' | 'leader' | 'volunteer'

export interface RoleSlot {
  name: string // ex.: "Voz", "Bateria"
  count: number // vagas por evento
  /** a vaga é ocupada por um grupo inteiro (ex.: grupo de voz do Louvor) */
  group?: boolean
  /** complemento mostrado junto do nome (ex.: "0 a 3 anos") */
  hint?: string
}

/** Grupo fixo de pessoas que entra junto na escala (ex.: grupo de voz) */
export interface MemberGroup {
  id: string
  name: string
  memberIds: string[]
}

export interface Ministry {
  id: string
  name: string
  color: string
  icon: string // nome do ícone (ver components/MinistryIcon)
  roles: RoleSlot[] // funções do ministério e quantas pessoas cada uma precisa por culto
  leaderIds: string[]
  description: string
  groups?: MemberGroup[]
}

export interface MemberMinistry {
  ministryId: string
  roles: string[]
}

export interface Member {
  id: string
  name: string
  phone: string
  access: Access
  ministries: MemberMinistry[]
  /** Preferência do voluntário: quantas vezes no máximo quer servir por mês */
  maxPerMonth: number
  /** PIN de 4 dígitos (só no servidor, com hash; nunca vai para o app) */
  pinHash?: string
  /** Visão do app: a pessoa já criou o PIN? */
  hasPin?: boolean
  /** 'form' = a própria pessoa se cadastrou pelo formulário público */
  source?: 'form'
  /** Cultos fixos da semana em que a pessoa não pode servir (chave "diaDaSemana-HH:MM", ex.: "0-09:30") */
  recurringOff?: string[]
  /** Equipes em que a pessoa tem interesse em servir (ainda não serve) */
  interests?: MemberMinistry[]
  createdAt?: string
}

export interface Song {
  id: string
  title: string
  artist: string
  key: string // tom
  link?: string // cifra/áudio
}

export interface ChurchEvent {
  id: string
  title: string
  date: string // YYYY-MM-DD
  time: string // HH:mm ('' = horário a definir)
  endTime?: string // HH:mm
  endDate?: string // YYYY-MM-DD, para eventos de vários dias
  allDay?: boolean
  special?: boolean // evento especial (fora da agenda fixa)
  place?: string // ex.: "Templo", "Garagem"
  activity?: string // ex.: "Curso", "GC", "Ensaio"
  responsible?: string // ex.: "Pr. Alexandre"
  ministryIds: string[] // ministérios que servem neste evento (pode ser vazio)
  /** Vagas próprias deste evento (substituem as vagas padrão dos ministérios). Ex.: gravação do News */
  slots?: { ministryId: string; role: string; count: number }[]
  setlist: Song[] // repertório (Louvor)
}

export type AssignmentStatus = 'pending' | 'confirmed' | 'declined'

export interface Assignment {
  id: string
  eventId: string
  ministryId: string
  role: string
  memberId: string
  status: AssignmentStatus
  /** escalado como parte de um grupo (ex.: grupo de voz) */
  groupId?: string
  checkedIn?: boolean
  feedback?: { rating: number; comment: string }
}

export interface SwapRequest {
  id: string
  assignmentId: string
  fromMemberId: string
  reason: string
  createdAt: string
  status: 'open' | 'accepted' | 'cancelled'
  acceptedById?: string
}

export interface Notice {
  id: string
  ministryId: string | null // null = aviso geral da igreja
  authorId: string
  title: string
  body: string
  createdAt: string
}

/** Demanda de um ministério com responsável e prazo (ex.: artes do Follow) */
export interface Task {
  id: string
  ministryId: string
  title: string // ex.: "Arte · Culto de Ceia (15/11)"
  eventId?: string // evento relacionado, se houver
  details: string // formato, texto, referências…
  assigneeId: string
  dueDate: string // YYYY-MM-DD
  status: 'open' | 'done'
  link?: string // link da arte entregue (Drive, Canva…)
  createdBy: string
  createdAt: string
  doneAt?: string
}

export interface AppData {
  version: number
  /** Momento (ms) da primeira alteração feita sobre os dados padrão da demonstração */
  modifiedAt?: number
  /** Configurações gerais (dados reais) */
  settings?: {
    /** false/ausente = só administradores entram no app (fase de cadastros) */
    open?: boolean
  }
  /** Dados reais: até que data a agenda fixa já foi gerada (YYYY-MM-DD) */
  generatedUntil?: string
  /** Dados reais: versão da estrutura do código já aplicada (funções renomeadas etc.) */
  codeVersion?: number
  ministries: Ministry[]
  members: Member[]
  events: ChurchEvent[]
  assignments: Assignment[]
  unavailability: Record<string, string[]> // memberId -> datas YYYY-MM-DD
  swaps: SwapRequest[]
  notices: Notice[]
  tasks?: Task[]
}
