# my_parking — Guia para Agentes de IA

## Stack
- NextJS 16 (App Router, TypeScript strict)
- Drizzle ORM + SQLite (dev) → Supabase/PostgreSQL (producao)
- qrcode (npm) — geracao QR como data URI
- use-next-sse (npm) — SSE tempo real
- jose + bcryptjs — auth JWT em cookie httpOnly
- CSS puro (modules ou global)

## Schema conceitual (DB)
3 tabelas:
- parking_spots: code (numero unico da vaga, ex: 1, 2, 3...), status (disponivel/ocupada)
- entries: spot_id, token (UUID unico do QR), entry_time, exit_time (NULL ate saida)
- admin_users: username, password_hash

### Diferenca entre code e token
- code: identificador fixo da vaga, puramente numerico (1, 2, 3...). Usado p/ ordenar e selecionar vaga de menor numero.
- token: UUID gerado sob demanda a cada entrada. Unico por sessao. Codificado no QR. Vincula entrada com saida. Expirado apos uso.
- Nao confundir: code é permanente da vaga, token é temporario da sessao.

## Estrutura de pastas
src/
├── app/                          # App Router (paginas)
│   ├── api/                      # API routes (cada rota tem route.ts + route.spec.ts)
│   │   ├── confirmar/
│   │   │   ├── route.ts
│   │   │   └── route.spec.ts
│   │   ├── saida/
│   │   │   ├── route.ts
│   │   │   └── route.spec.ts
│   │   ├── sse/
│   │   │   └── entrada/           # SSE endpoint (substitui entrada/preparar REST)
│   │   │       ├── route.ts
│   │   │       └── route.spec.ts
│   │   ├── vagas/
│   │   │   ├── route.ts
│   │   │   └── route.spec.ts
│   │   └── admin/
│   │       └── login/
│   │           ├── route.ts
│   │           └── route.spec.ts
│   ├── entrada/                   # Tela inicial com QR code via SSE
│   │   └── confirmar/             # Pagina apos escanear QR
│   ├── saida/                     # (planejado) Pagina saida (input token)
│   └── admin/                     # (planejado) Painel admin (dashboard, CRUD, historico)
├── lib/
│   ├── constants.ts               # Config (BASE_URL, TOTAL_SPOTS, etc.)
│   ├── db/                        # Drizzle client setup + schema
│   ├── repositories/              # Interfaces + sqlite/ impl
│   │   └── supabase/              # (futuro) mesma interface, novo cliente
│   ├── sse/
│   │   └── entrada-emitter.ts     # EventEmitter p/ SSE entrada
│   ├── use-cases/                 # Regras negocio + testes
│   │   ├── prepare-entry.ts
│   │   ├── prepare-entry.spec.ts
│   │   ├── confirm-entry.ts
│   │   ├── confirm-entry.spec.ts
│   │   ├── process-exit.ts
│   │   ├── process-exit.spec.ts
│   │   ├── get-all-spots.ts
│   │   ├── get-all-spots.spec.ts
│   │   ├── factory.ts             # Cria use cases com repos injetados
│   │   ├── test-helper.ts         # Factory p/ DB :memory: + repos
│   │   ├── admin-login.ts
│   │   └── admin-login.spec.ts
│   └── auth/
│       └── index.ts               # protectRoute() p/ API routes admin
└── components/                    # Componentes UI

## Repository pattern
Interfaces definem contratos p/ operacoes DB. Use cases dependem das interfaces, nunca da implementacao. Troca SQLite ↔ Supabase muda so injecao; use cases intactos.

### Factory pattern
Use cases nunca sao instanciados diretamente nas rotas. `src/lib/use-cases/factory.ts` expoe funcoes `createXxxUseCase()` que cuidam da injecao de dependencias. Toda nova rota deve usar a factory — proibido instanciar repos ou use cases diretamente no handler. Troca SQLite → Supabase requer alterar so `factory.ts`.

## Fluxo entrada (SSE-based)
1. Tela inicial conecta `GET /api/sse/entrada` (SSE). Servidor executa `PrepareEntryUseCase`: busca vaga de menor code → gera token UUID → gera QR codificando `/entrada/confirmar?token=<uuid>` → envia evento `vaga_ocupada` com `{ spot, token, qrDataUrl }`.
2. Visitante escaneia QR → abre `/entrada/confirmar?token=<uuid>`.
3. Pagina `/entrada/confirmar` faz `GET /api/confirmar?token=<uuid>` → cria entry + marca spot ocupada → retorna QR (mesmo token) p/ visitante salvar.
4. `GET /api/confirmar` emite SSE via `entrada-emitter.ts` (no `finally`, mesmo em erro) → servidor SSE tenta gerar nova vaga.
5. Nao existe rota REST `/api/entrada/preparar` — preparacao ocorre dentro do SSE handler.
6. **Sem vagas:** SSE envia evento `error` mas **conexao permanece aberta**, ouvindo novas saidas.

## Fluxo saida
1. Visitante chega saida, acessa /saida com token (do QR salvo no celular)
2. Endpoint saida: busca entry pelo token (exit_time IS NULL) → marca exit_time=now → spot volta disponivel
3. `GET /api/saida` emite SSE via `entrada-emitter.ts` → SSE acorda, `PrepareEntryUseCase` acha vaga livre, envia novo QR.
4. **Conexao SSE nunca morre por falta de vagas** — fica ouvindo ate saida liberar ou cliente fechar.

## Server-Sent Events (SSE)
- use-next-sse p/ SSE unidirecional servidor → tela entrada
- Rota: `GET /api/sse/entrada` — cria conexao SSE
- `src/lib/sse/entrada-emitter.ts` — EventEmitter singleton notificado por `GET /api/confirmar` e `GET /api/saida`
- Conexao **persistente**: quando sem vagas, envia `error` e continua ouvindo. Ao receber evento (via saida), tenta preparar nova entrada.
- Evento `vaga_ocupada` — payload `{ spot, token, qrDataUrl }`
- Evento `error` — payload `{ error }` (sem vagas, conexao nao fecha)
- Quem emite eventos no emitter:
  - `GET /api/confirmar` — sempre (finally), sucesso ou erro
  - `GET /api/saida` — apenas em saida bem-sucedida
- useSSE hook no client: ao receber `vaga_ocupada`, renderiza novo QR
- Reconexao automatica configurada

## Auth
- Admin login via JWT em cookie httpOnly
- `src/lib/auth/index.ts` exporta `protectRoute(request)` — verifica JWT no cookie `auth_token`, retorna `NextResponse` (401) ou `null` (autorizado)
- Usada em rotas protegidas (`GET /api/vagas`, futuras rotas admin)
- Retorna 401 se token invalido/ausente
- Pagina admin redireciona p/ /admin/login se 401

## Migrations
- Geradas via `drizzle-kit generate` — nunca escrever SQL manual p/ schema
- Aplicadas com `drizzle-orm/better-sqlite3/migrator` (inclusive em testes)
- Proibido: ler arquivos `.sql` com `fs`/`path`, fazer parse manual de SQL, ou executar statements raw
- `test-helper.ts` usa `migrate(db, { migrationsFolder: './drizzle' })` p/ manter `:memory:` sincronizado

## Dados seed
Vagas fixas com codes numericos (1, 2, 3... N). N definido em config. Todas iguais (sem tipo).

## API Routes
- Cada endpoint tem `route.ts` + `route.spec.ts` no mesmo diretorio, mesmo nivel
- Handler usa funcao factory de `src/lib/use-cases/factory.ts` — nunca instancia repos ou use cases diretamente
- Tratamento explicito de erros: mapear `instanceof` de erros do use case p/ status HTTP
- Nunca expor stack trace ou detalhes internos nas respostas de erro
- `route.spec.ts` usa `vi.mock("@/lib/db")` p/ injetar `:memory:` no handler
  - Cada spec cria `Database(":memory:")` + roda `migrate()` no `beforeEach`
  - Seed com `db.insert()` direto no body do teste
- Toda criacao, alteracao ou delecao de rota exige documentacao no README.md

## Documentacao (README.md)
- README.md contem secao `## API Routes` com todas as rotas documentadas
- Cada rota documenta: metodo HTTP, path, descricao, parametros (query/body), formato exato da resposta (200, 4xx, 5xx)
  - Exemplo de formato:
  ```md
  ### `GET /api/vagas`
  Retorna todas as vagas com código e status.

  **Resposta 200:**
  ```json
  { "success": true, "total": 3, "spots": [{ "id": 1, "code": 1, "status": "disponivel" }] }
  ```

  **Resposta 500:**
  ```json
  { "success": false, "error": "Erro ao buscar vagas" }
  ```
  ```
- Toda alteracao em rotas deve atualizar esta secao

## Testes
- Vitest p/ testes unitarios (focus use-cases, por enquanto)
- Cada use case tem arquivo `.spec.ts` no mesmo nivel, mesmo nome
  - Ex: `prepare-entry.ts` ⇄ `prepare-entry.spec.ts`
- Testes usam `createTestRepos()` do `test-helper.ts` p/ isolar cenario
- Cada suite de testes cria **todas** as entidades que precisa (arrange completo)
  - Nada compartilhado entre suites — cada uma roda com DB `:memory:` proprio
- `test-helper.ts`: `createTestRepos()` abre `:memory:`, aplica migrations com `migrate()` do drizzle, retorna repos prontos
- Toda nova feature exige teste(s)
- Todo bug fix exige teste de regressao
- `npm test` executa todos; `npm run test:watch` p/ TDD
- Testes E2E de API routes seguem mesmo padrao: `route.spec.ts` no mesmo nivel de `route.ts`
  - Usam `vi.mock("@/lib/db")` p/ injetar `:memory:` e chamam o handler diretamente (`GET()`, `POST()`)
  - Testam status code + corpo da resposta (sucesso e erro)
- Scripts:
  - `npm test` — todos os testes
  - `npm run test:unit` — apenas `src/lib/use-cases`
  - `npm run test:e2e` — apenas `src/app/api`
  - `npm run test:watch` — watch mode

## Clean Code practices
- Single Responsibility: cada funcao/arquivo tem 1 proposito claro
- Funcoes curtas (~20 linhas maximo ideal)
- Sem numeros magicos — constantes nomeadas
- Nomes significativos p/ variaveis, funcoes, arquivos, tabelas, colunas
- DRY: extrair logicas repetidas p/ funcoes reutilizaveis
- Arquivos pequenos (~80-100 linhas maximo ideal)
- Tratamento de erros explicito (try/catch, nunca ignorar)
- TypeScript strict (evitar any, tipos bem definidos)
- Composicao sobre heranca
- Imports organizados: externos → internos, absolutos sobre relativos
- Pure functions onde possivel
- Early return p/ reduzir aninhamento
- Sem side effects escondidos
- Commits atomicos (Conventional Commits)
