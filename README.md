# Kurio — Marketplace de NFTs

Implementação do desafio frontend **NFT Marketplace** (layout no Figma "Frontend Challenge"): descoberta, compra e conta do colecionador, em desktop e mobile. Toda a API, a autenticação, as carteiras, os pagamentos e o tempo real funcionam com dados simulados na camada de rede (MSW).

- **Demo:** https://junglegaming.netlify.app
- **Repositório:** https://github.com/JoaoVitorHz/junglegaming
- **Arquitetura e decisões:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Contratos REST e eventos:** [docs/API.md](docs/API.md)
- **Lighthouse:** [lighthouse/reports/summary.md](lighthouse/reports/summary.md)

## Stack

React 19 · TypeScript · Vite · TanStack Router · TanStack Query · Axios · Socket.IO (client) · Tailwind CSS v4 · shadcn/ui (Radix) · zod · MSW (+ `@mswjs/socket.io-binding`) · Playwright · Lighthouse.

## Requisitos e setup

- Node.js 20 ou superior (testado com 24.11) e npm 10 ou superior.

```bash
npm ci
npx playwright install chromium   # apenas para os testes E2E
npm run dev                       # http://localhost:5173 (com mocks)
```

## Variáveis de ambiente

Definidas em `.env` (versionado, sem segredos).

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Ativa a camada MSW (REST e Socket.IO simulados). Fica ligada também no build de demonstração |
| `VITE_API_URL` | `/api` | Base das chamadas REST |

## Credenciais fictícias

| Usuário | E-mail | Senha | Observações |
| --- | --- | --- | --- |
| Nova Sato | `colecionador@kurio.dev` | `Kurio@2026` | Carteiras principal (MetaMask/Ethereum) e secundária (Coinbase/Polygon); 1 favorito |
| Téo Mint | `artista@kurio.dev` | `Kurio@2026` | Carteira principal (WalletConnect/Ethereum); 2 favoritos |

Novos cadastros também funcionam. As senhas só existem como hash com salt no servidor simulado.

**Cupons:** `KURIO10` (10%), `GENESIS20` (20%), `LANCAMENTO5` (expirado). Qualquer outro código é inválido.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks |
| `npm run build` | Typecheck (`tsc -b`) + build otimizado em `dist/` |
| `npm run preview` | Serve o build (`vite preview`) |
| `npm run typecheck` | Verificação de tipos (app, config e testes) |
| `npm run lint` | oxlint (React, TypeScript, jsx-a11y) |
| `npm run test:e2e` | Playwright: build + preview automáticos, Chromium desktop (1440) e mobile (390) |
| `npm run test:e2e:update` | Regera as baselines de regressão visual |
| `npm run test:e2e:report` | Abre o relatório HTML (`playwright-report/`). Traces das falhas ficam em `test-results/` |
| `npm run audit` | Build + Lighthouse (Início e Detalhe, mobile e desktop, 3 medições) em `lighthouse/reports/` |

## Cenários da simulação

A simulação é determinística: seed fixo, ids e latências derivados. Há três formas de escolher o cenário:

1. **Painel "Simulação"** (botão no canto da tela, visível só com mocks): marque os cenários, dispare eventos e use "Restaurar cenário padrão" para voltar ao seed e recarregar.
2. **Query string na primeira carga:** `?mock=slow,payment-rejected` (lista separada por vírgula, persistida).
3. **API de controle:** `PUT /api/__mock/scenario { "presets": [...] }` e `POST /api/__mock/reset` (ver [docs/API.md](docs/API.md)).

| Preset | Efeito |
| --- | --- |
| _(nenhum)_ | Padrão: latência de 120 ms, tudo funciona |
| `instant` | Sem latência e liquidação de pedido em 300 ms (usado nos testes) |
| `slow` | Toda resposta REST demora 2,5 s (skeletons) |
| `variable-latency` | 100 ms a 1,8 s, estável por URL |
| `out-of-order` | Buscas mais curtas respondem por último |
| `offline` | Toda requisição REST falha com erro de rede |
| `flaky` | A primeira tentativa de cada requisição retorna 503 |
| `catalog-error` | Listagem e destaques retornam 500 |
| `empty` | Catálogo vazio |
| `favorites-fail` | Favoritar ou desfavoritar retorna 500 (rollback otimista) |
| `short-session` | A sessão expira 45 s após o login |
| `wallet-rejected` | A carteira recusa a conexão |
| `wallet-disconnect` | A carteira desconecta 8 s após conectar |
| `payment-rejected` | O pedido termina recusado |
| `slow-settlement` | O pedido fica pendente por 20 s |
| `order-timeout` | O pedido é criado, mas a resposta demora 15 s (o cliente expira em 8 s) |
| `checkout-price-change` | 1,5 s após a primeira cotação, o preço do 1º item sobe 0,15 ETH |
| `checkout-soldout` | 1,5 s após a primeira cotação, a edição do 1º item esgota |

## Como reproduzir os fluxos de falha

Em todos os roteiros abaixo, entre como `colecionador@kurio.dev` antes.

- **Preço alterado durante a compra:**
  1. Adicione um NFT, vá ao pagamento e clique em "Confirmar compra".
  2. Com a revisão aberta, use o painel → "Subir preço do 1º item do carrinho" (ou o preset `checkout-price-change`).
  3. A confirmação é bloqueada. "Atualizar valores" gera a nova cotação, que exige nova confirmação.
- **Edição esgotada:** com o carrinho aberto, use o painel → "Esgotar edição do 1º item do carrinho". O item é marcado e "Conectar e finalizar" fica bloqueado até você aceitar as alterações.
- **Pagamento recusado:** ative `payment-rejected` e conclua uma compra. A tela de recusa aparece e o carrinho é preservado.
- **Timeout com recuperação idempotente:** ative `order-timeout` e confirme. Após 8 s o cliente repete o envio com a mesma chave e chega ao recibo, com um único pedido criado.
- **Clique repetido:** ative `slow-settlement` e clique várias vezes em "Confirmar e pagar". Só um pedido é criado.
- **Queda do tempo real com pedido pendente:**
  1. Ative `slow-settlement` e confirme a compra.
  2. Use o painel → "Derrubar tempo real por 5 s" e recarregue a página.
  3. O acompanhamento é retomado e termina no recibo, sem criar outra compra.
- **Eventos duplicados ou antigos:** após mudar o preço de um NFT duas vezes, use "Reenviar evento antigo" e "Reenviar último evento". O preço exibido não regride.
- **Sessão expirada:** use o painel → "Expirar sessão no servidor" e navegue para uma área privada (ou ative `short-session` e aguarde 45 s). Você vai para o login com o destino preservado. No pagamento, o rascunho do formulário é restaurado.
- **Carteira:** `wallet-rejected` simula a recusa na conexão e `wallet-disconnect` a desconexão antes da confirmação (botão "Reconectar"). O link "Desconectar" do pagamento também desconecta.
- **Falha do catálogo e nova tentativa:** ative `catalog-error`. O catálogo mostra o erro. Desative o preset e clique em "Tentar novamente".
- **Rede lenta, offline e respostas fora de ordem:** use os presets `slow` (skeletons), `offline` e `out-of-order` (busque "g" e depois "golden": a resposta atrasada é descartada).

## Testes E2E (Playwright)

```bash
npm run test:e2e
```

Os testes rodam contra o build otimizado com mocks, em Chromium desktop e mobile. Cada teste usa um contexto novo, com storage isolado, e define o próprio cenário antes da primeira carga. Eventos em tempo real chegam pelo cliente Socket.IO, disparados pelo servidor simulado via `/api/__mock/*`, e as chamadas REST passam pelos handlers MSW.

**Cobertura:**

| Spec | O que cobre |
| --- | --- |
| `catalog.spec.ts` | Busca, filtros, ordenação, paginação, histórico, fora de ordem, vazio, skeletons, falha e nova tentativa, detalhe e 404 |
| `auth.spec.ts` | Cadastro, conflito, login, expiração (por endpoint e por relógio), logout e troca de usuário |
| `cart.spec.ts` | Quantidades, remoção, cupom, persistência e favoritos (com rollback) |
| `checkout.spec.ts` | Compra completa, recusa, clique repetido, timeout, carteira, expiração no checkout e tempo real (preço, esgotamento, eventos duplicados ou antigos, queda com pedido pendente) |
| `account.spec.ts` | Perfil, avatar, senha e carteiras |
| `a11y.spec.ts` | Teclado, foco em diálogos e drawers, erros de formulário, alt e overflow, anúncios |
| `visual.spec.ts` | Regressão visual de início, detalhe, carrinho e pagamento |

Saídas: relatório HTML em `playwright-report/` e traces e screenshots das falhas em `test-results/`. As baselines visuais ficam em `e2e/visual.spec.ts-snapshots/` (geradas no Windows; regenere em outro sistema operacional).

## Lighthouse

```bash
npm run audit
```

A auditoria serve o build com `serve -s dist` (gzip, como a CDN) e roda 3 medições por página e perfil. Ela grava os relatórios HTML/JSON, `summary.json` e `summary.md` (medianas, LCP/CLS/TBT, versões e ambiente). A configuração está em `lighthouse/config.mjs`. A análise dos resultados abaixo da meta está no [ARCHITECTURE.md](ARCHITECTURE.md#performance-lighthouse).

## Deploy (Netlify)

Publicado em **https://junglegaming.netlify.app**. O  define o build ( → ), o rewrite de SPA (acesso direto e refresh de qualquer rota servem o ; arquivos existentes têm prioridade) e os cabeçalhos do . Os mocks e o tempo real funcionam no ambiente publicado porque  está no .

O  mantém a configuração equivalente para a Vercel ().
