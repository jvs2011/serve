export type Access = 'admin' | 'leader' | 'volunteer'

export interface RoleSlot {
  name: string // ex.: "Vocal", "Bateria"
  count: number // vagas por evento
}

export interface Ministry {
  id: string
  name: string
  color: string
  icon: string // nome do ícone (ver components/MinistryIcon)
  roles: RoleSlot[] // funções do ministério e quantas pessoas cada uma precisa por culto
  leaderIds: string[]
  description: string
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

export interface AppData {
  version: number
  /** Momento (ms) da primeira alteração feita sobre os dados padrão da demonstração */
  modifiedAt?: number
  /** Dados reais: até que data a agenda fixa já foi gerada (YYYY-MM-DD) */
  generatedUntil?: string
  ministries: Ministry[]
  members: Member[]
  events: ChurchEvent[]
  assignments: Assignment[]
  unavailability: Record<string, string[]> // memberId -> datas YYYY-MM-DD
  swaps: SwapRequest[]
  notices: Notice[]
}
