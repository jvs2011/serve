# Serve · Lagoinha Franca

Web app (PWA) para gestão de escalas de voluntários dos ministérios da Lagoinha Franca, feito para uso exclusivo em celulares.

## Rodando

```bash
npm install
npm run dev        # abre em http://localhost:5173 (use --host para testar no celular na mesma rede)
npm test           # testes automáticos (agenda, escala, permissões, servidor, notificações)
npm run build      # roda os testes e gera /dist (se algum teste falhar, a publicação não acontece)
npm run build:single  # gera /dist-single/index.html, um arquivo único para prévia
```

Na tela de entrada há um perfil de demonstração para cada função do Follow (a primeira equipe a usar o app):
**Líder do Follow** (Rafaela: rascunho da escala, pedidos e gravações), **Projeção** (Bruno: escala pendente, troca para
assumir e o quadro Para a projeção), **Transmissão** (Gustavo: escala pendente e troca), **Fotografia** (Carolina) e
**Filmmaker** (Vitor: material do último culto para enviar), **Stories** (Bianca: fotos de um culto pelo histórico),
**Edição de fotos** (Lara), **Edição de vídeos** (Téo) e **Edição de artes** (Júlia: pedido com prazo e o material que
chegou para editar) e as três funções do **Lagoinha News**: **Filmmaker** (Davi: convite e filmagens para enviar),
**Apresentação** (Léo: convite da gravação) e **Edição** (Nina: filmagens recebidas e o vídeo do News para entregar).
Cada perfil mostra sugestões do que experimentar.
O administrador esconde ou mostra a demonstração em **Perfil → Demonstração na tela de entrada**.

## Funcionalidades

**Voluntário**
- Início com a próxima escala, confirmação/recusa em um toque e check-in no dia
- Pedido de troca: quem tem a mesma função vê o pedido e assume
- Disponibilidade: calendário para marcar os dias em que não pode servir
- Limite de 4 escalas por mês por pessoa na escala automática (o líder pode passar disso ao escalar à mão)
- Feedback com estrelas depois do culto
- Gamificação: pontos (check-in, confirmação, feedback, cobrir troca) e níveis
- Repertório do culto com tom e link para a cifra
- Avisos da igreja e do ministério

Todo mundo vê um guia rápido no primeiro acesso (como confirmar, avisar indisponibilidade, pedir troca,
ativar notificações e, para líderes, como publicar a escala). Dá para rever em **Perfil → Como usar o Serve**.

**Líder / Coordenação**
- Escala em **rascunho**: o que o líder escala (à mão, por grupo ou automática) só aparece para os líderes;
  ao tocar em **Publicar** a equipe vê e recebe a notificação. Dá para descartar o rascunho.
  Se faltar publicar algo dos próximos 3 dias, o líder recebe um lembrete às 18h
- Escala automática (por culto ou para os próximos 30 dias) respeitando indisponibilidade,
  conflito com outras escalas, limite mensal e rodízio justo
- Escalar manualmente com lista de candidatos ordenada e alertas de conflito
  (ex.: "Já escalado em Mídia"), indisponibilidade e limite do mês
- Painel com vagas preenchidas, pendências, recusas, presença, avaliação média
  e "Quem precisa de cuidado" (voluntários afastados)
- Ranking de dedicação, equipe com atalho para WhatsApp, avisos e repertório
- Criar eventos (coordenação)
- **Cultos da semana** (coordenação, em Perfil): a agenda fixa fica nos dados e é editável no app —
  dia, horário, local, ministérios e frequência (toda semana, semanas do mês, a cada 15 dias, meses).
  Ao salvar, os próximos eventos são atualizados sem perder as escalas; dias editados à mão ou cancelados ficam como estão
- **Editar evento** (lápis no evento): a coordenação edita qualquer evento (num culto fixo, muda só aquele dia);
  o líder edita os eventos do próprio ministério. Quem está escalado é avisado se mudar dia, horário ou local
- Repertório: botão **Avisar a equipe** manda as músicas para quem está escalado no Louvor
- Ao adicionar música: **Sem ideias? Veja as músicas que já tocamos** lista o repertório da igreja (`src/data/repertoire.ts`)
  e o que já foi colocado no app (com artista, tom e link); as mais tocadas aparecem primeiro e um toque adiciona

**Eventos do ministério**
- O líder cria eventos do próprio ministério (ex.: ações internas e externas do We Care) na aba Escalas:
  nome, interno/externo, dia, horário, local e quantas pessoas de cada função; depois escala à mão ou na automática
- O líder pode cancelar esses eventos

**Grupos de voz (Louvor)**
- O líder monta os grupos na aba **Grupos** do Louvor (nome + quem tem a função Voz)
- No culto, a vaga de Voz é ocupada por um grupo inteiro: "Escolher grupo" mostra quantos estão
  disponíveis em cada grupo e quantas vezes o grupo serviu nos últimos 45 dias
- Quem estiver indisponível ou já escalado em outro ministério fica de fora; cada pessoa confirma a sua parte
- A escala automática faz rodízio entre os grupos; dá para escalar uma pessoa avulsa na vaga de Voz

**Artes (Follow)**
- Líder do Follow (ou admin) pede uma arte na aba **Artes** do ministério: escolhe um dos próximos
  cultos/eventos da agenda (título e prazo se preenchem) ou "Outro evento ou arte", detalhes,
  responsável (quem é da edição do tipo de pedido aparece primeiro, ex.: Edição de fotos) e data de entrega
- O responsável vê a arte e o prazo (em X dias / amanhã / hoje / atrasada) na aba e na tela Início,
  e marca como entregue com o link (Drive, Canva…)
- Notificações: nova arte → responsável; entregue → líderes; véspera do prazo → responsável

**Material e destinos**
- Fotografia, Filmmaker e Filmmaker (News) enviam o link do material depois de servir (botão na própria escala; cartão
  "Envie as fotos" na tela Início; lembrete no dia seguinte). Os líderes recebem o aviso e acompanham em
  **Material dos últimos cultos** (aba Escalas do ministério). A edição daquele material também recebe
  (`RoleSlot.deliverTo`): Fotografia → **Edição de fotos**, Filmmaker → **Edição de vídeos**, Filmmaker (News) →
  **Edição do News**; na tela Início de quem edita aparece **Material para editar**
- Lagoinha News: **Filmmaker (News)** e **Apresentação (News)** recebem o convite da gravação; **Edição do News** recebe o pedido
  do vídeo editado
- **Novo pedido** tem quatro tipos: **Edição de arte**, **Edição de vídeo** (vídeos gerais), **Edição de fotos** e
  **Edição do News** (textos por tipo em `src/lib/requests.ts`). Arte, vídeo e fotos vão para a **Projeção** e/ou
  **Mídias sociais**; o News vai só para a projeção e é pedido por **domingo**
  (aparece na escala da Projeção dos cultos da manhã e da noite)

**Projeção**
- Dentro da escala do culto, a Projeção (e os líderes do Follow) vê o quadro **Para a projeção**: vídeo do News,
  artes com o botão Copiar link e as músicas do Louvor; na tela Início aparece o resumo ("4 músicas · 1 arte · vídeo do News")
- Avisos: entregue com link → a Projeção escalada naquele culto; repertório enviado pelo Louvor → Louvor e Projeção do culto

### Painel do líder no computador (/painel)

**serve.lagoinhafranca.com/painel** é uma área só para **líderes e coordenação**, feita para computador e tablet
(em tela menor que 760 px aparece o aviso para usar o app; voluntário que entra vê que o painel é da liderança).
Usa o mesmo login (celular + PIN) e os mesmos dados do app, e só é baixado por quem abre o /painel.

- **Menu lateral**: troca de ministério (a coordenação vê todos), seções e números do que está pendente; no tablet
  o menu vira uma coluna de ícones
- **Visão geral**: vagas preenchidas, vagas abertas (14 dias), quem não respondeu, trocas pedidas, rascunho e
  presença; lista **Precisa da sua atenção** com a ação ali mesmo (publicar rascunho, escalar substituto,
  escalar na vaga aberta, chamar no WhatsApp, ver pedido atrasado); próximos cultos com o preenchimento;
  material dos últimos cultos (o link abre direto); quem precisa de cuidado; para a coordenação, o
  preenchimento de todos os ministérios
- **Escalas em grade**: cada linha é um culto/evento e cada coluna uma função (2, 4 ou 8 semanas, navegando
  semana a semana). Cores: confirmado, aguardando, rascunho e vaga aberta. **+ Escalar** abre os candidatos em
  ordem (disponibilidade, outras escalas, limite do mês, rodízio; grupos de voz no Louvor); clicar em um nome
  troca ou tira da escala. Preencher automático (tudo ou um culto), publicar/descartar o rascunho,
  **Copiar para o WhatsApp** (texto pronto da escala publicada) e **Imprimir** (paisagem)
- **Equipe**: tabela com busca, filtro por função e "só quem está sem escala"; escalas no mês × limite,
  próxima escala, última vez que serviu, quanto confirma e indisponibilidade; clique abre os detalhes da
  pessoa; **Baixar planilha** (CSV)
- **Pedidos** (Follow): tabela de arte, vídeo, fotos e News com prazo, destino e responsável; novo pedido,
  editar, marcar como entregue com o link, reabrir e excluir
- **Avisos**: escrever o aviso e ver os enviados (a coordenação também manda para a igreja toda)

O código fica em `src/panel/` e as regras (grade, atenção, números da equipe, texto do WhatsApp) em
`src/lib/panel.ts`. No computador, a tela do app mostra o link para o painel.

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
  panel/             painel do líder no computador (/painel): visão geral, grade de escalas, equipe, pedidos, avisos
  lib/panel.ts       regras do painel do computador
  components/        UI compartilhada
server/              servidor: armazenamento (Upstash/memória), login, sessões, regras
api/                 funções da Vercel (/api/login, /api/verify, /api/data, /api/action…)
```

## Dados reais e login

O app tem dois modos:

- **Dados reais**: guardados no servidor (funções da Vercel em `api/` + banco Upstash Redis).
  As pessoas entram com **celular + PIN de 4 números**. No primeiro acesso, a pessoa cria o PIN
  (sequências óbvias como 1234 ou 1111 não são aceitas). Errar o PIN 10 vezes bloqueia o número até
  o dia seguinte. Esqueceu o PIN? O administrador redefine em Pessoas e a pessoa cria outro.
  O PIN fica só no servidor, com hash (scrypt); nunca vai para o app.
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
interesse (opcional) e autorização de uso dos dados. As equipes aparecem em grupos, com uma linha sobre cada uma
(no Follow: Nos cultos, Lagoinha News e Edição e site; o layout fica em `src/lib/signupTeams.ts`). O usuário é criado na hora (marcado como
"formulário" em Pessoas). Um número já cadastrado nunca é alterado por ali. Limite de 15 envios
por hora por conexão e um campo invisível contra robôs.

### Notificações no celular

Cada pessoa ativa em **Perfil → Notificações** (ou no convite da tela Início). Ela recebe:

- nova escala (à mão ou automática) e lembrete na véspera, por volta das 18h (agendamento diário da Vercel em `vercel.json`);
- pedido de troca, se tiver a mesma função e estiver livre; troca resolvida, para quem pediu;
- escala recusada, para os líderes do ministério; avisos do ministério ou da igreja;
- mudança ou cancelamento de um evento em que está escalado; repertório enviado pelo Louvor;
- às 18h: lembrete de confirmar (escalas pendentes daqui a 3 dias) e, para os líderes, vagas abertas
  nos próximos 3 dias e escala ainda em rascunho.

O app confere a cada 30 segundos (só com ele aberto) se algo mudou e baixa os dados só quando mudaram.

As chaves de segurança das notificações (VAPID) são criadas sozinhas e guardadas no banco.
No iPhone (iOS 16.4 ou mais novo), as notificações só funcionam com o Serve instalado na tela inicial.
Opcional: `CRON_SECRET` na Vercel protege a rota do lembrete diário.

### Backup e planilha

Todo dia, junto com o lembrete das 18h, o servidor guarda uma cópia de todos os dados no banco
(`serve:backup:AAAA-MM-DD`, mantida por 15 dias). Em **Pessoas**, o administrador baixa a planilha
de pessoas (CSV que abre no Excel/Google Planilhas).

### Desenvolvimento local

`npm run dev` já atende as rotas `/api` com um banco em memória (apagado ao reiniciar).
O administrador de teste é **(16) 99999-0000** (cria o PIN no primeiro acesso).

## Próximos passos para produção

1. **Notificações por WhatsApp** (API oficial), além das notificações no celular.
2. **Cadastro de ministérios, funções e eventos** pela coordenação dentro do app.
3. **Privacidade (LGPD)**: termo de consentimento no primeiro acesso e página de política de privacidade.
