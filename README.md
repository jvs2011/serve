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
  data/seed.ts       dados de demonstração: os 15 ministérios da Lagoinha Franca (funções sugeridas),
                     ~150 voluntários fictícios e agenda de exemplo
  data/store.tsx     estado + todas as ações (hoje em localStorage)
  lib/schedule.ts    regras de escala: disponibilidade, ranking de candidatos, escala automática, pontos
  lib/selectors.ts   consultas derivadas
  screens/           telas (Início, Escalas, Evento, Trocas, Ministérios, Perfil, Painel…)
  components/        UI compartilhada
```

## Próximos passos para produção

Hoje os dados ficam no `localStorage` do aparelho (cada celular vê a sua cópia). Para uso real:

1. **Backend e login**: Supabase (Postgres + login por SMS/WhatsApp OTP). As tabelas espelham `types.ts`;
   basta trocar as funções de `store.tsx` por chamadas ao banco.
2. **Notificações**: lembrete de escala e pedidos de troca via WhatsApp (API oficial) e/ou push do PWA.
3. **Cadastro de voluntários e ministérios** pela coordenação dentro do app.
4. **Deploy** em domínio próprio (ex.: serve.lagoinhafranca.com.br) com HTTPS para o PWA instalar.
