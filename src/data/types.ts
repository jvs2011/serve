export type Access = 'admin' | 'leader' | 'volunteer'

export interface RoleSlot {
  name: string // ex.: "Voz", "Bateria"
  count: number // vagas por evento
  /** a vaga é ocupada por um grupo inteiro (ex.: grupo de voz do Louvor) */
  group?: boolean
  /** complemento mostrado junto do nome (ex.: "0 a 3 anos") */
  hint?: string
  /** quem serve nessa função envia um material depois (ex.: "as fotos"): o link fica na escala */
  delivery?: string
  /** função que recebe esse material para editar (ex.: Fotografia → Edição de fotos) */
  deliverTo?: string
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

/** Culto ou encontro fixo da semana (a coordenação edita no app) */
export interface WeeklySlot {
  id: string
  day: number // 0 = domingo … 6 = sábado
  time: string // HH:mm
  endTime?: string
  title: string
  place?: string
  activity?: string
  responsible?: string
  ministryIds: string[]
  /** Semanas do mês em que acontece (1ª a 5ª ocorrência do dia); vazio = toda semana */
  weeks?: number[]
  /** Meses em que acontece (1 a 12); vazio = todos */
  months?: number[]
  /** A cada 15 dias: uma data em que acontece (YYYY-MM-DD) */
  biweekly?: string
}

export interface ChurchEvent {
  id: string
  /** Culto fixo que gerou este evento */
  slotId?: string
  /** Ajustado à mão: mudanças no culto fixo não sobrescrevem este dia */
  edited?: boolean
  /** Momento em que o repertório foi enviado para a equipe */
  setlistSentAt?: string
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
  /** escala em rascunho: só os líderes veem; a pessoa é avisada quando o líder publica */
  draft?: boolean
  checkedIn?: boolean
  feedback?: { rating: number; comment: string }
  /** material enviado depois de servir (fotos, vídeo, filmagens) */
  delivery?: { link: string; at: string }
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
  /** último dia em que o aviso aparece (YYYY-MM-DD); sem data = até ser retirado */
  until?: string
  /** retirado pela liderança: some para a equipe, mas continua no histórico do líder */
  archivedAt?: string
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
  link?: string // link entregue (Drive, Canva, YouTube…)
  /** 'video' = edição de vídeo; 'news' = vídeo do Lagoinha News; sem valor = arte */
  kind?: 'video' | 'photo' | 'news'
  /** vai para a projeção: a Projeção recebe o link na escala do culto (`eventId`) */
  projection?: boolean
  /** vai para as mídias sociais */
  social?: boolean
  /** vídeo do News: domingo em que passa (YYYY-MM-DD), nos cultos da manhã e da noite */
  airDate?: string
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
    /** false = a tela de entrada não mostra a demonstração */
    demo?: boolean
  }
  /** Dados reais: até que data a agenda fixa já foi gerada (YYYY-MM-DD) */
  generatedUntil?: string
  /** Agenda fixa da semana */
  weekly?: WeeklySlot[]
  /** Dias de cultos fixos cancelados (slotId|YYYY-MM-DD), para não serem gerados de novo */
  skipped?: string[]
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
