# Contratos REST e eventos

Fonte única dos tipos: [`src/api/contracts.ts`](../src/api/contracts.ts) (schemas zod usados pelo cliente Axios para validar respostas e pelos handlers MSW para validar requisições). Rotas em [`src/api/endpoints.ts`](../src/api/endpoints.ts).

- Base: `/api` (`VITE_API_URL`).
- Formato: JSON. Valores em ETH são **strings decimais** (`"1.19"`, `"0.016"`); quantidades são inteiros.
- Autenticação: `Authorization: Bearer <token>`.
- Carrinho de visitante: `X-Cart-Id: guest_<uuid>` (gerado pelo cliente e enviado em toda requisição).
- Idempotência de pedidos: `Idempotency-Key: <chave>`.

## Erros

Toda resposta de erro tem o formato:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Verifique os campos destacados.", "fieldErrors": { "email": "Informe um e-mail válido" }, "details": {} } }
```

| Código | HTTP | Quando |
| --- | ---: | --- |
| `VALIDATION_ERROR` | 422 | Corpo inválido; `fieldErrors` por campo |
| `UNAUTHENTICATED` | 401 | Sem token ou token desconhecido |
| `SESSION_EXPIRED` | 401 | Token expirado (o cliente encerra a sessão e leva ao login preservando o destino) |
| `INVALID_CREDENTIALS` | 401 | Login com e-mail/senha incorretos |
| `FORBIDDEN` | 403 | Recurso de outro usuário (ex.: pedido) |
| `NOT_FOUND` | 404 | NFT, item, pedido ou carteira inexistente |
| `EMAIL_TAKEN` / `USERNAME_TAKEN` | 409 | Conflito de cadastro/perfil (`fieldErrors`) |
| `AVAILABILITY_CONFLICT` | 409 | Quantidade acima do disponível/limite (`details.limit`) |
| `EDITION_UNAVAILABLE` | 409 | Edição esgotada |
| `QUOTE_OUTDATED` | 409 | Cotação desatualizada; `details.quote` traz a nova cotação |
| `IDEMPOTENCY_CONFLICT` | 409 | Chave de idempotência reutilizada com corpo diferente |
| `COUPON_INVALID` / `COUPON_EXPIRED` | 422 | Cupom inexistente ou expirado |
| `WALLET_REJECTED` | 403 | Usuário recusou a conexão na carteira |
| `WALLET_DISCONNECTED` | 409 | Conexão da carteira encerrada antes do pedido |
| `SERVICE_UNAVAILABLE` / `INTERNAL_ERROR` | 503 / 500 | Falha transitória (o cliente repete automaticamente consultas) |

## Sessão e conta

| Método e rota | Corpo | Resposta |
| --- | --- | --- |
| `POST /auth/register` | `{ username, email, password }` | `201 Session` · 409 `EMAIL_TAKEN`/`USERNAME_TAKEN` · 422 |
| `POST /auth/login` | `{ email, password }` | `200 Session` · 401 `INVALID_CREDENTIALS` |
| `GET /auth/session` | – | `200 Session` · 401 `SESSION_EXPIRED`/`UNAUTHENTICATED` |
| `POST /auth/logout` | – | `204` |

`Session = { token, expiresAt, user: User }`. Login e cadastro **mesclam o carrinho do visitante** indicado em `X-Cart-Id` no carrinho do usuário (respeitando disponibilidade). Senhas só existem como hash SHA-256 com salt no servidor simulado.

## NFTs

| Método e rota | Parâmetros | Resposta |
| --- | --- | --- |
| `GET /nfts` | `q`, `category` (lista separada por vírgula), `network` (lista), `minPrice`, `maxPrice`, `sort` (`recent`, `price-asc`, `price-desc`, `popular`), `tab` (`all`, `new`, `trending`), `page`, `pageSize` (≤ 48), `collection`, `exclude`, `ids` | `{ items: NftSummary[], page, pageSize, total, totalPages, facets: { categories, networks, priceRange } }` |
| `GET /nfts/featured` | – | `{ hero: NftSummary[], spotlight: NftSummary }` |
| `GET /nfts/:slug` | – | `NftDetail` · 404 |

As facetas consideram os demais filtros, mas não o próprio (contagens de filtros combináveis). Cada NFT tem `version`, incrementada a cada mudança de preço/disponibilidade.

## Favoritos (autenticado)

| Método e rota | Resposta |
| --- | --- |
| `GET /me/favorites` | `{ nftIds: string[] }` |
| `PUT /me/favorites/:nftId` | `{ nftIds }` · 404 |
| `DELETE /me/favorites/:nftId` | `{ nftIds }` |

## Carrinho (visitante via `X-Cart-Id` ou usuário)

| Método e rota | Corpo | Resposta |
| --- | --- | --- |
| `GET /cart` | – | `Cart` |
| `POST /cart/items` | `{ nftId, editionId, quantity }` | `201 Cart` · 409 `AVAILABILITY_CONFLICT`/`EDITION_UNAVAILABLE` |
| `PATCH /cart/items/:id` | `{ quantity }` | `Cart` · 409 |
| `DELETE /cart/items/:id` | – | `Cart` |
| `PUT /cart/coupon` | `{ code }` | `Cart` · 422 `COUPON_INVALID`/`COUPON_EXPIRED` |
| `DELETE /cart/coupon` | – | `Cart` |
| `POST /cart/acknowledge` | – | `Cart` (aceita preços atuais e ajusta quantidades ao disponível) |

`Cart = { id, ownerType, items: CartItem[], coupon, totals: { subtotal, discount, networkFee, total }, itemCount, hasChanges, version }`. Cada `CartItem` traz `unitPrice` (atual), `acknowledgedUnitPrice` (último preço aceito), `available`, `maxPerOrder`, `nftVersion` e `status` (`ok`, `price_changed`, `insufficient`, `unavailable`). Os totais sempre usam o preço atual; itens esgotados não são cobrados.

## Cotação, carteira e pedidos (autenticado)

| Método e rota | Corpo / cabeçalhos | Resposta |
| --- | --- | --- |
| `POST /quotes` | – | `201 Quote` (`valid`, `issues`, `totals`, `cartVersion`, `expiresAt` em 5 min) |
| `POST /wallet-connections` | `{ walletId, provider, network }` | `201 WalletConnection` · 403 `WALLET_REJECTED` |
| `GET /wallet-connections/:id` | – | `WalletConnection` (`status`: `connected`/`disconnected`) |
| `DELETE /wallet-connections/:id` | – | `204` |
| `POST /orders` | `Idempotency-Key` + `{ quoteId, walletId, connectionId, collector }` | `201 Order` (novo) · `200 Order` (mesma chave e mesmo corpo) · 409 `IDEMPOTENCY_CONFLICT`/`QUOTE_OUTDATED`/`WALLET_DISCONNECTED` |
| `GET /orders?status=pending` | – | `{ items: Order[] }` |
| `GET /orders/:id` | – | `Order` · 403 · 404 |

Regras de pedido:

- A cotação é revalidada no envio: se preço, disponibilidade, cupom ou taxa mudaram desde a cotação, a API responde `409 QUOTE_OUTDATED` com a nova cotação — o cliente exige nova confirmação.
- A mesma `Idempotency-Key` com o mesmo corpo devolve o mesmo pedido (inclusive após timeout); com corpo diferente, `409 IDEMPOTENCY_CONFLICT`.
- O pedido nasce `pending` e termina `confirmed` ou `rejected` (estados terminais). Na confirmação, a disponibilidade é baixada e **apenas os itens e quantidades comprados** saem do carrinho. Na recusa, nada muda.
- `Order` é um snapshot (itens, preços, cupom, totais): mudanças posteriores no catálogo não alteram o recibo.

## Perfil e carteiras (autenticado)

| Método e rota | Corpo | Resposta |
| --- | --- | --- |
| `GET /me/profile` | – | `User` |
| `PATCH /me/profile` | `{ displayName, username, email, ensName, walletNickname }` | `User` · 409 · 422 |
| `PUT /me/avatar` | `{ dataUrl }` (PNG/JPG/WebP, ≤ 300 KB) | `User` · 422 |
| `DELETE /me/avatar` | – | `User` |
| `POST /me/password` | `{ currentPassword, newPassword }` | `204` · 422 (`currentPassword` incorreta) |
| `GET /me/wallets` | – | `{ items: Wallet[] }` |
| `PUT /me/wallets/:role` | `role` = `primary`/`secondary`; `WalletInput` | `201/200 Wallet` · 422 (endereço repetido; secundária sem principal) |

## Eventos Socket.IO

Conexão: `io(origin, { path: '/realtime/', transports: ['websocket'], auth: { token } })`. Sem token, o cliente recebe só eventos públicos.

Todo evento tem identidade estável (`id`), recurso afetado (`resource`) e versão (`version`).

```ts
// Público — todas as conexões
type NftUpdated = {
  id: string            // ex.: "evt_000042"
  type: 'nft.updated'
  resource: { type: 'nft'; id: string }
  version: number       // versão do NFT após a mudança
  occurredAt: string
  data: { price: string; editions: { id: string; available: number }[] }
}

// Privado — apenas conexões do dono do pedido
type OrderUpdated = {
  id: string
  type: 'order.updated'
  resource: { type: 'order'; id: string }
  version: number
  occurredAt: string
  userId: string
  data: { status: 'pending' | 'confirmed' | 'rejected'; statusReason: string | null }
}
```

Evento auxiliar: `session.invalid` (servidor → cliente) quando o token do handshake está expirado.

## Endpoints de controle da simulação (`/api/__mock/*`)

Existem somente com os mocks ativos e não passam pela simulação de rede.

| Rota | Uso |
| --- | --- |
| `GET /__mock/state` | Presets ativos, presets disponíveis, conexões de tempo real e últimos eventos |
| `PUT /__mock/scenario` `{ presets }` | Define o cenário |
| `POST /__mock/reset` `{ presets? }` | Restaura o seed (banco, timers, eventos, conexões) |
| `POST /__mock/nft-update` `{ slug \| nftId \| fromCart, price \| priceDelta, soldOut \| editions }` | Altera um NFT e publica `nft.updated` |
| `POST /__mock/replay-event` `{ eventId? , mode: 'last' \| 'stale' }` | Reenvia um evento (duplicata ou evento antigo) |
| `POST /__mock/socket/disconnect` `{ blockMs }` | Derruba as conexões e recusa novas por `blockMs` |
| `POST /__mock/expire-session` | Expira todas as sessões no servidor |
