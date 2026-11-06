# Serve · Lagoinha Franca

Web app (PWA) para gestão de escalas de voluntários dos ministérios da Lagoinha Franca, feito para uso exclusivo em celulares.

## Rodando

```bash
npm install
npm run dev        # abre em http://localhost:5173 (use --host para testar no celular na mesma rede)
npm run build      # gera /dist para publicar (Vercel, Netlify, Cloudflare Pages…)
npm run build:single  # gera /dist-single/index.html, um arquivo único para prévia
```

Na tela de entrada há três perfis de demonstração: **Voluntária** (Ana), **Líder** (Mariana, Louvor) e **Coordenação** (Lucas, todos os ministérios).

## Funcionalidades

**Voluntário**
- Início com a próxima escala, confirmação/recusa em um toque e check-in no dia
- Pedido de troca: quem tem a mesma função vê o pedido e assume
- Disponibilidade: calendário para marcar os dias em que não pode servir
- Preferência de frequência ("quero servir até N vezes por mês")
- Feedback com estrelas depois do culto
- Gamificação: pontos (check-in, confirmação, feedback, cobrir troca) e níveis
- Repertório do culto com tom e link para a cifra
- Avisos da igreja e do ministério

**Líder / Coordenação**
- Escala automática (por culto ou para os próximos 30 dias) respeitando indisponibilidade,
  conflito com outras escalas, limite mensal e rodízio justo
- Escalar manualmente com lista de candidatos ordenada e alertas de conflito
  (ex.: "Já escalado em Mídia"), indisponibilidade e limite do mês
- Painel com vagas preenchidas, pendências, recusas, presença, avaliação média
  e "Quem precisa de cuidado" (voluntários afastados)
- Ranking de dedicação, equipe com atalho para WhatsApp, avisos e repertório
- Criar eventos (coordenação)

## Estrutura

```
src/
  data/types.ts      modelo de dados (ministérios, membros, eventos, escalas, trocas, avisos)
  data/seed.ts       dados de demonstração: os 16 ministérios da Lagoinha Franca (funções sugeridas),
                     ~150 voluntários fictícios e agenda de exemplo
  data/actions.ts    todas as alterações de dados + permissões (usado no app e no servidor)
  data/store.tsx     estado do app: modo real (API) ou demonstração (localStorage)
  lib/people.ts      telefone e iniciais do login
  lib/schedule.ts    regras de escala: disponibilidade, ranking de candidatos, escala automática, pontos
  lib/selectors.ts   consultas derivadas
  screens/           telas (Início, Escalas, Evento, Trocas, Ministérios, Perfil, Painel…)
  components/        UI compartilhada
server/              servidor: armazenamento (Upstash/memória), login, sessões, regras
api/                 funções da Vercel (/api/login, /api/verify, /api/data, /api/action…)
```

## Dados reais e login

O app tem dois modos:

- **Dados reais**: guardados no servidor (funções da Vercel em `api/` + banco Upstash Redis).
  As pessoas entram com o **celular** e depois escolhem as **iniciais do próprio nome** entre 6 opções
  (ex.: João Victor da Silva → J V S). Depois de 5 erros, o número fica bloqueado por 15 minutos.
- **Demonstração**: dados de exemplo só no aparelho; as alterações são desfeitas após 10 minutos.

Quem cadastra as pessoas é o **administrador** (Perfil → Pessoas): nome completo, celular,
ministérios, funções em cada ministério e se é líder.

### Configuração na Vercel (uma vez)

1. **Storage → Create Database → Upstash for Redis** (plano gratuito) e conecte ao projeto `serve`.
   A Vercel cria sozinha as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN`.
2. **Settings → Environment Variables**:
   - `ADMIN_PHONE`: celular do primeiro administrador, com DDD
   - `ADMIN_NAME`: nome completo dele (as iniciais do login saem daqui)
   - `AUTH_SECRET` (opcional): um texto aleatório longo
3. **Deployments → Redeploy** para as variáveis valerem.

### Formulário público de cadastro

`/cadastro/<ministério>` (ex.: **serve.lagoinhafranca.com/cadastro/follow**) é uma página só de formulário,
para mandar no grupo do WhatsApp: nome completo, celular, equipes em que serve, equipes em que tem
interesse (opcional) e autorização de uso dos dados. O usuário é criado na hora (marcado como
"formulário" em Pessoas). Um número já cadastrado nunca é alterado por ali. Limite de 15 envios
por hora por conexão e um campo invisível contra robôs.

### Notificações no celular

Cada pessoa ativa em **Perfil → Notificações** (ou no convite da tela Início). Ela recebe:

- nova escala (à mão ou automática) e lembrete na véspera, por volta das 18h (agendamento diário da Vercel em `vercel.json`);
- pedido de troca, se tiver a mesma função e estiver livre; troca resolvida, para quem pediu;
- escala recusada, para os líderes do ministério; avisos do ministério ou da igreja.

As chaves de segurança das notificações (VAPID) são criadas sozinhas e guardadas no banco.
No iPhone (iOS 16.4 ou mais novo), as notificações só funcionam com o Serve instalado na tela inicial.
Opcional: `CRON_SECRET` na Vercel protege a rota do lembrete diário.

### Desenvolvimento local

`npm run dev` já atende as rotas `/api` com um banco em memória (apagado ao reiniciar).
O administrador de teste é **(16) 99999-0000**, iniciais **A T**.

## Próximos passos para produção

1. **Notificações por WhatsApp** (API oficial), além das notificações no celular.
2. **Cadastro de ministérios, funções e eventos** pela coordenação dentro do app.
3. **Privacidade (LGPD)**: termo de consentimento no primeiro acesso e página de política de privacidade.
