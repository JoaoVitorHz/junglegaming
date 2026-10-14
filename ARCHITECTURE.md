# Arquitetura — Kurio NFT Marketplace

Este documento explica como a aplicação está organizada, as políticas de sessão, carrinho, cache e tempo real, e registra limitações, decisões de UX e desvios do Figma. Os contratos estão em [docs/API.md](docs/API.md).

## Visão geral

```
React (páginas e componentes)
  │  hooks (TanStack Query / Router)          ← estado remoto, URL e proteção de rotas
  ▼
src/api (Axios + zod)                         ← única saída REST; valida respostas contra os contratos
src/realtime (socket.io-client)               ← única entrada de eventos; aplica no cache do Query
  │
  ▼  rede (fetch / WebSocket)
MSW (service worker + interceptador WebSocket)  ← camada de mocks, ativada por VITE_ENABLE_MOCKS
  └─ src/mocks: handlers REST, servidor Socket.IO simulado, banco persistido, cenários
```

A aplicação não sabe que está falando com mocks: componentes, hooks e o cliente Axios não têm respostas fictícias nem caminhos alternativos. Desligando os mocks (`VITE_ENABLE_MOCKS=false`), as mesmas chamadas vão para `VITE_API_URL`.

### Estrutura

| Pasta | Responsabilidade |
| --- | --- |
| `src/api` | Contratos zod (`contracts.ts`), rotas (`endpoints.ts`), cliente Axios (`client.ts`), erros normalizados (`errors.ts`) e funções por recurso (`services.ts`) |
| `src/auth` | Store de sessão (fora do React, via `useSyncExternalStore`) e hooks de login, cadastro e logout |
| `src/queries` | Chaves de cache, política do QueryClient e hooks de domínio (catálogo, carrinho, favoritos, conta, pedidos) |
| `src/realtime` | Provider Socket.IO por sessão e aplicação idempotente/versionada dos eventos no cache |
| `src/routes`, `src/router.tsx` | Rotas (TanStack Router, definidas em código), schemas dos search params e guarda das rotas privadas |
| `src/pages`, `src/features`, `src/components` | Telas, blocos por fluxo e componentes (shadcn/ui adaptados em `components/ui`) |
| `src/mocks` | Camada de simulação: seed, banco persistido, regras de negócio, handlers, servidor Socket.IO, cenários e painel |
| `src/lib/eth.ts` | Aritmética de ETH sem perda de precisão (bigint em wei) |

## Valores em ETH

ETH trafega como string decimal e todo cálculo converte para wei (`bigint`, 18 casas). `number` nunca é usado para dinheiro. A UI só formata o que a API devolveu (`formatEth`), sem arredondar além do valor. Subtotal, desconto, taxa e total vêm sempre da API; o cliente não recalcula totais.

## Roteamento e estado na URL

- TanStack Router com rotas em código e `validateSearch` (zod) em cada rota com parâmetros. Valores inválidos na URL caem no padrão (`?page=abc` vira página 1).
- No catálogo, busca, coleções, redes, faixa de preço, aba, ordenação e página ficam todos na URL e são a fonte da consulta à API (`toNftListQuery`). Mudar qualquer filtro remove `page`, o que reinicia a paginação. A busca digitada usa debounce de 350 ms e gera entradas de histórico normais.
- Rotas privadas (`/pagamento`, `/pedidos/:id`, `/perfil`, `/perfil/carteiras`, `/perfil/favoritos`) passam por um layout com `beforeLoad`, que redireciona para `/entrar?redirect=<destino>&reason=required|expired`. O `AuthedLayout` também observa a sessão depois do carregamento, para tratar expiração durante a navegação. Logout explícito leva à Início.
- As páginas de entrada (Início e Detalhe) ficam no bundle principal; as demais rotas são carregadas sob demanda (`lazyRouteComponent`).
- Rota inexistente renderiza o 404, e erros de rota têm página com nova tentativa.

## Sessão

- Login e cadastro devolvem `{ token, expiresAt, user }`. O store guarda isso em `localStorage` (nunca a senha) e agenda a expiração local.
- **Recuperação após refresh:** o store reidrata a sessão e o app confirma com `GET /auth/session`. Se a API responder 401, a sessão é encerrada.
- **Expiração:** detectada pelo timer local ou por qualquer `401 SESSION_EXPIRED/UNAUTHENTICATED` (interceptor do Axios, só quando o token enviado ainda é o atual). O estado vira `expired`, e o usuário vai para o login com `reason=expired` e o destino preservado. O checkout guarda um rascunho por usuário em `sessionStorage`, restaurado ao voltar.
- **Logout e troca de usuário:** `onSessionEnd` cancela e remove do cache tudo sob `['private', userId]`. O socket da sessão anterior é desconectado e seus listeners liberados (o efeito depende do token). Eventos `order.updated` de outro usuário são descartados pelo servidor simulado (roteamento por token) e também pelo cliente (`event.userId !== currentUserId`).

## Carrinho

- O carrinho vive na API. O visitante é identificado por `X-Cart-Id` (gerado no cliente e persistido), e o usuário, pela sessão. Assim o carrinho sobrevive ao refresh.
- No login ou cadastro, a API mescla o carrinho do visitante no do usuário, respeitando a disponibilidade. O cliente troca então o id de visitante.
- No cache, o carrinho fica em `['private', owner, 'cart']`, com `owner` igual ao `userId` ou a `guest:<id>`: nunca se mistura entre pessoas.
- As mutations do carrinho rodam em série (`scope: 'cart'`), o que impede respostas fora de ordem. A resposta da API substitui o cache.
- **Atualização otimista com rollback:** alterar a quantidade de um item e favoritar/desfavoritar. A mudança aparece na hora e, se a API falhar, o estado anterior é restaurado e o usuário é avisado.
- Mudanças de preço ou disponibilidade marcam o item (`price_changed`, `insufficient`, `unavailable`) e bloqueiam "Conectar e finalizar" até o usuário aceitar (`POST /cart/acknowledge`).

## Política de cache, retries e sincronização

| Aspecto | Política |
| --- | --- |
| `staleTime` | 30 s padrão; carrinho 10 s; destaques 60 s; sessão `Infinity` (validada uma vez por carga) |
| `gcTime` | 5 min |
| Retry de consultas | Só falhas transitórias (rede, timeout, 5xx), até 2 novas tentativas com backoff exponencial (600 ms → 4 s). 4xx nunca é repetido |
| Retry de mutations | Nenhum automático. Exceção: criação de pedido, repetida até 3 vezes com a mesma chave de idempotência em timeout/falha de rede |
| Timeout HTTP | 8 s (Axios) |
| Consultas obsoletas | Chave = todos os parâmetros enviados, `AbortSignal` repassado ao Axios e `keepPreviousData` no catálogo. Uma resposta antiga nunca sobrescreve a atual |
| Invalidação | Mutations escrevem a resposta no cache (`setQueryData`). Eventos e reconexões invalidam o necessário |
| Foco da janela | `refetchOnWindowFocus` ativo |
| Pedido pendente | Polling a cada 3 s enquanto `pending`, além do evento `order.updated` |

## Tempo real e reconciliação com REST

- Uma conexão Socket.IO por sessão (`forceNew`), com `auth.token` no handshake. O `socket.io-client` é importado sob demanda, depois que os mocks estão ativos.
- **Idempotência e ordenação** (`apply-events.ts`): cada `event.id` é aplicado uma única vez, e um evento com `version` menor ou igual à última conhecida do recurso é descartado. As versões vindas do REST também são registradas (`noteResourceVersion`), e o cache só é alterado se `cached.version < event.version`. Duplicatas e eventos atrasados nunca regridem o estado.
- **`nft.updated`:** atualiza preço e disponibilidade nas listas, destaques e detalhe sem refetch, e invalida os carrinhos que contêm o NFT (a API recalcula status e totais). O usuário recebe aviso acessível (toast em região `aria-live`).
- **`order.updated`:** atualiza o pedido e invalida o recibo, os pendentes, o carrinho (se confirmado) e o catálogo.
- **Reconexão:** no `connect` posterior a uma queda, o cliente invalida `['nfts']` e `['private']`. Os recursos ativos são reconciliados com a API, porque o servidor não reenvia eventos perdidos. Há um banner acessível enquanto reconecta.
- **Checkout com cotação desatualizada:** a revisão compara a cotação com o carrinho (versão, `hasChanges` e total) e desabilita a confirmação. O servidor também recusa com `409 QUOTE_OUTDATED`, então a garantia não depende só do evento chegar.

### Transporte dos eventos nos mocks e limitações

O app abre um WebSocket real (`transports: ['websocket']`, path `/realtime/`). O MSW o intercepta com `ws.link`, e o [`@mswjs/socket.io-binding`](https://github.com/mswjs/socket.io-binding) codifica e decodifica os pacotes Engine.IO/Socket.IO.

- **Path:** é `/realtime/` em vez de `/socket.io/`. O MSW reescreve o prefixo `/socket.io/` antes do match e, na raiz, o padrão colidiria com o WebSocket de HMR do Vite.
- **Handshake:** o binding responde automaticamente (sid fixo). Não há long-polling nem upgrade.
- **Heartbeat:** o mock envia `ping` manualmente a cada 20 s para o cliente não expirar a conexão.
- **Namespaces e rooms:** só o namespace `/` é suportado e não há rooms. O roteamento por usuário é feito no servidor simulado, lendo o token do pacote `CONNECT`.
- **Ordem de carregamento:** o `engine.io-client` captura `globalThis.WebSocket` ao ser avaliado, por isso ele só é importado depois de o MSW iniciar.
- **Escopo:** o tempo real funciona por aba. Duas abas têm "servidores" independentes, sincronizados apenas pelo `localStorage` em cada requisição.

## Pedidos: idempotência, falhas e recuperação

1. **Formulário:** valida o formulário, conecta a carteira (`POST /wallet-connections`, que pode ser recusada) e pede a cotação (`POST /quotes`).
2. **Revisão:** a revisão mostra a cotação. Se ela ficar desatualizada, aparece a opção "Atualizar valores", que aceita as mudanças, gera nova cotação e exige confirmar de novo. Se a carteira desconectar, aparece "Reconectar".
3. **Confirmar:** gera uma `Idempotency-Key` por cotação, guardada em `sessionStorage` (a mesma após refresh). O botão fica bloqueado durante o envio (ref + estado), e cliques repetidos são ignorados.
4. **Timeout ou falha de rede:** o envio é repetido com a mesma chave, e a API devolve o mesmo pedido.
5. **Pedido pendente:** o id é guardado por usuário. Ao recarregar a página ou voltar ao pagamento, a tela de acompanhamento é retomada, a partir do id local ou de `GET /orders?status=pending`.
6. **Pedido confirmado:** o app vai para o recibo, que é o snapshot gravado pela API. **Pedido recusado:** a tela de recusa informa que nada foi cobrado e que os itens continuam no carrinho. O recibo só existe para pedido confirmado.

## Camada de mocks (MSW)

- **Ativação:** a camada é ativada por `VITE_ENABLE_MOCKS=true` (`.env`), inclusive no build de demonstração. `main.tsx` baixa o app e os mocks em paralelo e só renderiza depois que o MSW está ativo. Nesse momento marca `html[data-mocks="ready"]` (usado pelos testes e pela auditoria).
- **Banco:** um estado único (catálogo, usuários, sessões, favoritos, carrinhos, cotações, conexões, carteiras e pedidos) persistido em `localStorage` (`kurio:mock:db`). Regras de negócio em `logic.ts`, compartilhadas por REST e eventos.
- **Determinismo:** o seed é fixo (PRNG com semente), e os ids, hashes de transação e latência variável são derivados deterministicamente. "Restaurar cenário padrão" volta exatamente ao seed.
- **Simulação de rede:** `withNetwork` aplica latência fixa ou variável, ordem invertida de respostas, offline (`HttpResponse.error()`), 503 na primeira tentativa e status forçado por rota.
- **Liquidação de pedidos:** feita por timers. Se a página recarregar com pedido pendente, `settleDueOrders()` conclui os vencidos e reagenda os demais.

## Acessibilidade

- O app tem skip link, foco visível em todos os controles (`:focus-visible` com anel de 2 px), títulos de página e `aria-current` exato nos links (`activeOptions.exact`).
- Diálogos e drawers (Radix/shadcn) prendem o foco e devolvem-no ao gatilho. O Esc fecha a camada do topo.
- **Formulários:** label, `aria-required`, `aria-invalid` e `aria-describedby` ligando o campo à dica ou ao erro. O foco vai para o primeiro campo inválido. O asterisco é decorativo, com "(obrigatório)" em texto para leitores de tela.
- **Feedback:** mutations e eventos em tempo real são anunciados por toasts (região `aria-live`). Também há status de quantidade, contagem de resultados e reconexão.
- **Estados não dependem só de cor:** edição esgotada é riscada e tem "(esgotada)" em texto; itens alterados no carrinho têm ícone e texto; favoritos usam `aria-pressed`.
- **Imagens:** as artes de NFT têm descrição textual do personagem; imagens decorativas usam `alt=""`.
- **Movimento:** `prefers-reduced-motion` desliga animações e o shimmer dos skeletons.
- **Layout:** não há overflow horizontal em 390, 768 e 1440 px (validado nos testes).

## Decisões de UX e desvios do Figma

| Tema | Decisão |
| --- | --- |
| Login/Cadastro desktop | Diálogo sobre o hero da Início (o Figma mostra a Início inteira ao fundo); no mobile, tela cheia como no frame |
| Contagens das facetas | Refletem os dados reais filtrados (o Figma usa números ilustrativos como "(33)") |
| Ações fora do escopo (Criadores, Aprenda, ajuda, social login, "Esqueceu a senha?", atividade, ofertas, downloads, "Ler mais") | Mantidas no layout, com `aria-disabled` e tooltip "Disponível em breve", sem simular sucesso |
| Newsletter | Valida o e-mail e informa que não há inscrição nesta demonstração (sem endpoint no escopo) |
| Pagamento mobile | O frame mobile não tem os dados do colecionador; eles ficam recolhidos em "Dados do colecionador" (pré-preenchidos do perfil e abertos se houver erro) |
| "Carteira e rede" (desktop) | Lista de carteiras cadastradas + tipo de carteira; o tipo segue a carteira cadastrada escolhida |
| Revisão do pedido | Etapa extra (diálogo) antes do envio, exigida pelo enunciado; não existe no Figma |
| Estado pendente/recusado | Telas próprias no mesmo padrão visual (não desenhadas) |
| Perfil | Um único "Salvar" (como no Figma) valida tudo antes e salva perfil + senha (se preenchida) |
| Carteiras | "Editar" mostra o formulário; "Igual à carteira principal" copia os dados, mas exige outro endereço |
| Cards (desktop) | Ações de carrinho/favorito/detalhe aparecem no hover/foco (variante do frame de login); no mobile só o coração |
| Detalhe — avaliações | A aba mostra a nota média; comentários não fazem parte dos contratos |
| Paginação "Mais desta coleção" | Grade de 5 no desktop e rolagem horizontal no mobile (sem os pontos de paginação do Figma) |
| Recibo | Inclui a linha de desconto quando há cupom; o link do Etherscan é marcado como simulado |

### Assets

- **Artes dos NFTs:** exportadas do Figma (4 artes) e convertidas para WebP em 160, 480 e 960 px, servidas com `srcset`. O Figma também referenciava duas imagens que não aparecem em nenhum frame; elas foram ignoradas.
- **Ícones:** o ícone "Thank you" do recibo e os ícones sociais, Google e Facebook foram exportados em SVG do Figma. Os ícones "Iconly" do Figma foram substituídos pelos equivalentes do `lucide-react`.
- **Fonte:** Roboto Mono (400/500/700, subset latino) servida localmente via `@fontsource`.

## Performance (Lighthouse)

Medianas em `lighthouse/reports/summary.md`:

- **Desktop:** Início e Detalhe com Performance 98–99, Accessibility, Best Practices e SEO 100.
- **Mobile:** Performance 80–82, demais categorias 100.

**Por que o mobile fica abaixo de 90:** o LCP observado sem throttling é de ~0,6 s, mas o LCP simulado (CPU 4×, 1,6 Mbps) é de ~4,2 s. Duas causas:

1. **A camada de mocks está no caminho crítico.** São cerca de 100 KB de JS (MSW, banco, seed e handlers), mais o registro do service worker, e a renderização espera o MSW para não deixar requisições escaparem. O enunciado exige auditar com os mocks e sem atalhos, então essa camada não foi removida do build auditado.
2. **SPA renderizada no cliente.** O elemento de LCP (primeira arte do catálogo ou do detalhe) depende do JS e de uma resposta da API (com latência simulada de 120 ms).

**Otimizações aplicadas:**

- app e mocks baixados em paralelo e `socket.io-client` sob demanda;
- páginas de entrada no bundle principal;
- imagens responsivas, com `fetchpriority` na primeira dobra;
- compressão no servidor;
- altura mínima do `main` (CLS de 0,219 para 0 no detalhe desktop);
- `robots.txt` (SEO de 92 para 100).

**Próximos passos possíveis:** SSR/pré-render da primeira dobra, CSS crítico inline e trocar zod por `zod/mini` no cliente.

## Limitações conhecidas

- Os dados são simulados no navegador, por aba. Abrir duas abas não sincroniza eventos entre elas.
- As baselines de regressão visual foram geradas no Windows (sufixo `-win32`). Em outro sistema operacional, regenere com `npm run test:e2e:update`.
- Integrações reais (blockchain, extensões de carteira e gateways) estão fora do escopo. Os hashes de transação e os links de explorador são simulados.
