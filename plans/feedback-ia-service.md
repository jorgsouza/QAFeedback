# Plan: Serviço de IA para feedback (backend + extensão)

> **Source PRD:** `PRD/PRD — Serviço de IA para feedback (título e corpo) + integração na extensão.md` (relativo à raiz do repositório)

## Architectural decisions

Durable decisions that apply across all phases:

- **Backend routes:** `GET /health` (or `/v1/health`) and `POST /v1/refine-issue` (nome final pode ser ajustado desde que documentado).
- **Backend auth:** Uma convenção única — ex. `Authorization: Bearer <api_key>` ou `X-Api-Key` — validada no servidor antes de chamar o modelo.
- **Modelo:** Google **Gemini** (versão configurável por variável de ambiente), com prompt estável versionado no repositório do serviço.
- **Extension orchestration:** O **service worker** chama o backend de IA e, em seguida, reutiliza a lógica existente de criação de issue no GitHub (token e `createGitHubIssue`); a **página alvo** não faz `fetch` direto com a API key do serviço de IA.
- **Settings model:** `ExtensionSettings` ganha campos opcionais `iaServiceBaseUrl` e `iaServiceApiKey` (nomes exatos podem seguir o padrão camelCase existente). **Domínios permitidos** permanecem só para injeção do content script.
- **Título da issue:** Sempre derivado (IA ou fallback); **teto de caracteres** aplicado no cliente após resposta ou no fallback (alvo ~120–200).
- **Fallback:** Primeiras **6** tokens separados por whitespace após `trim` na descrição; descrição vazia impede envio.
- **Permissões MV3:** Reutilizar `optional_host_permissions` / fluxo de pedido de permissão ao guardar URL nova, se o host da IA não estiver coberto por permissões já concedidas.

---

## Phase 1: Backend de IA executável em local

**User stories:** US5; fundação para US1–US2 (lado servidor).

### What to build

Serviço HTTP (stack a escolha no implementar — ex. Node + Hono/Express ou Python FastAPI) que corre em **`http://127.0.0.1:<porta>`** para desenvolvimento, lendo **`GEMINI_API_KEY`** (e opcionalmente modelo) do ambiente. Implementar **`GET /health`** que falha (não-200) se a chave estiver ausente em ambientes onde o refine for obrigatório, ou que reporte “degraded” conforme decisão de implementação documentada. Implementar **`POST /v1/refine-issue`**: validar API key de cliente; sanitizar/truncar entrada alinhado ao PRD; chamar Gemini; devolver JSON `{ title, body }`. Incluir testes automatizados para sanitização/truncamento e para rejeição sem auth. Documentar no README do serviço: variáveis, `curl` de exemplo, e nota para deploy futuro (ex. Cloud Run).

### Acceptance criteria

- [x] `GET /health` responde em local com o contrato acordado quando configurado corretamente.
- [x] `POST /v1/refine-issue` com key válida devolve `title` e `body` coerentes com entrada de exemplo (teste manual ou snapshot controlado).
- [x] Pedidos sem key ou com key errada recebem **401**.
- [x] Testes cobrem pelo menos sanitização/truncamento e auth.
- [x] README do backend permite a outra pessoa da equipa subir o serviço em &lt; 10 minutos.

---

## Phase 2: Configuração na extensão (storage + opções)

**User stories:** US4.

### What to build

Estender o modelo persistido e a página de **opções** com **URL base do serviço de IA** e **API key** (campos opcionais, armazenados em `chrome.storage.local` com o resto das settings). Validar formato básico de URL; ao guardar, solicitar **host permission** para o origin do serviço se necessário (sem misturar com “Domínios permitidos”). O service worker deve conseguir **ler** estes valores ao tratar mensagens.

### Acceptance criteria

- [x] Utilizador pode gravar, limpar e regravar URL e key nas opções sem corromper token GitHub nem lista de repos.
- [x] Permissão de host para o domínio da IA é pedida quando aplicável e documentada em DOCUMENTATION.md.
- [x] Com campos vazios, nenhuma chamada ao backend é feita por defeito nos fluxos seguintes.

---

## Phase 3: Pipeline “Criar issue” com IA e fallback

**User stories:** US1, US2, RF1–RF4, RNF1/RNF4.

### What to build

Remover o campo de **título** do formulário no modal; manter validação de **“O que aconteceu”**. Implementar utilitário de **fallback de título** (6 palavras + teto de caracteres). No fluxo de **CREATE_ISSUE** (ou mensagem dedicada que o UI invoca): se URL+key configurados, chamar o backend com timeout; em sucesso, usar `title` e `body` devolvidos para montar o payload da issue GitHub; em falha/timeout, usar fallback de título e corpo atual (`buildIssueBody` com descrição original). Estado de **busy** e mensagem de carregamento durante a IA. Erros 401 com mensagem amigável. Testes unitários para fallback e para integração simulada (mock fetch) no SW ou módulo partilhado.

### Acceptance criteria

- [x] Sem URL/key de IA, issue cria-se com título fallback e corpo como hoje.
- [x] Com IA mockada ou real em local, issue cria-se com título/corpo devolvidos pelo serviço.
- [x] Timeout ou 5xx não impede criação com fallback.
- [x] PAT e criação GitHub permanecem no SW; key da IA não aparece na consola da página alvo.

---

## Phase 4: Indicador IA, health/retry e Preview com título editável

**User stories:** US3, US5 (operacional); RF5–RF6.

### What to build

No cabeçalho do modal (ou zona visível), indicador **IA** (verde/vermelho) conforme último resultado de **`GET /health`** ao abrir o modal; clique no indicador repete o health check (**retry**). No separador **Preview**, mostrar explicitamente o **título** que será enviado ao GitHub e permitir **edição** desse título antes de **Criar issue** (estado local sincronizado com o payload enviado). Tooltip ou texto curto explicando vermelho (“IA indisponível — título automático (6 palavras)”). Atualizar testes de UI/componente onde existam.

### Acceptance criteria

- [x] Ao abrir o modal, o estado verde/vermelho reflete o health ou ausência de configuração.
- [x] Retry atualiza o estado sem recarregar a página.
- [x] Preview permite alterar o título e o valor alterado é o usado no `CREATE_ISSUE` seguinte.
- [x] Documentação do utilizador menciona o indicador e o fallback.

---

## Granularidade

**Quatro fases mantidas** (sem fundir), conforme confirmação do utilizador.
