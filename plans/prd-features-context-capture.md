# Plano: contexto rico para issues (PRD `PRD/features.md`)

> **Fonte:** `PRD/features.md` — oito eixos (timeline, rede, estado visual, runtime, ambiente, performance, DOM, privacidade) + narrativa da issue. **Fora de âmbito por agora:** qualquer etapa do PRD sobre IA / sugestões automáticas de título ou triagem.  
> **Objetivo:** evoluir a extensão QA Feedback de “contexto técnico básico” para um **relato estruturado e seguro**, alinhado ao PRD, sem despejar telemetria crua.

---

## 1. Decisões de arquitetura (duráveis)

Estas decisões devem guiar todas as fases; revisar só com motivo forte.

| Decisão | Escolha proposta | Notas |
|--------|-------------------|--------|
| **Onde corre a coleta “pesada”** | MAIN world (`page-bridge`) + content script (UI / shadow) + opcionalmente service worker (CDP/HAR já existente) | Manter uma única fonte de verdade em memória na página; SW só para o que a página não vê (HAR). |
| **Formato interno** | Um único objeto versionado (ex. `CapturedIssueContext` v1) com sub-blocos: `session`, `page`, `uiState`, `interactionTimeline`, `network`, `runtimeErrors`, `performance`, `privacyMeta` | `TechnicalContextPayload` atual vira núcleo ou é migrado; evitar duplicar campos entre tipos. |
| **Limites padrão** | Ring buffers: timeline 20–50 eventos; rede “resumo” 15–30 entradas; console/erros com cap por nível; payloads truncados | PRD exige limites explícitos para memória e tamanho da issue. |
| **Rede sem HAR** | Resumo via monkey-patch **fetch** + **XMLHttpRequest** no bridge; classificar erro / lento / “perto do submit” | HAR (CDP) continua **opcional** (`fullNetworkDiagnostic`); a maioria dos QAs não terá debugger. |
| **Privacidade** | Pipeline único: **sanitizar antes** de guardar no estado e antes de gerar Markdown/anexos | Expandir `sanitizer.ts` e reutilizar padrões do `redactHarRoot` (headers sensíveis). |
| **Narrativa** | Camada `IssueNarrativeBuilder` (ou evolução de `issue-builder.ts`) que consome o modelo enriquecido e gera seções estáveis para GitHub/Jira | Separar “payload bruto” (debug) de “texto da issue” (leitura humana), mesmo que no MVP só exista o segundo. |

---

## 2. Inventário: o que o código faz hoje

Mapeamento objetivo para não reinventar nem quebrar o que já funciona.

### 2.1 Modelo de dados (`extension/src/shared/types.ts`)

- **`TechnicalContextPayload`**: `page` (URL sanitizada, rota SPA `pathname`/`routeSlug`/`routeLabel`/…, viewport, screen, DPR, touch, `viewModeHint`), `element?` (`ElementContext`: tag, id, classes, `safeAttributes`), `console[]`, `failedRequests[]`.
- **`ConsoleEntry`**: `level` error \| warn \| log, `message` (string única).
- **`FailedRequestEntry`**: method, url, status, message — **sem** duração, timestamp, content-type, correlation id, nem requests com status 2xx.

### 2.2 Ponte na página (`extension/src/injected/page-bridge.ts`)

- Intercepta `console.error` / `warn` / `log` (buffer ~20, emite snapshot com últimos 8).
- Intercepta só **`fetch`**: regista entrada quando `!res.ok` (buffer ~20, emite últimos 5).
- **Não** cobre `XMLHttpRequest`.
- **Não** regista `window.onerror` nem `unhandledrejection` (erros fora de `console.*` podem não aparecer).
- **Não** há timeline de cliques, teclas, navegação, scroll, focus.

### 2.3 Montagem do contexto (`extension/src/shared/context-collector.ts`)

- `ensurePageBridgeInjected()` + `readBridgeSnapshot()` → merge com `buildTechnicalContext({ lastTarget, bridge })`.
- Limites: `MAX_CONSOLE = 8`, `MAX_FAILED = 5`.
- `captureElementContext` usa `sanitizeElementAttributes` (remove attrs sensíveis por nome).

### 2.4 Página e SPA (`extension/src/shared/page-route-context.ts`, `location-subscription.ts`)

- Rota técnica e rótulo humano já resolvidos para Markdown e chip na UI.
- Subscrição a mudanças de URL (SPA) já existe — útil para **timeline** (“navegou para …”) e para invalidar/atualizar contexto.

### 2.5 Markdown da issue (`extension/src/shared/issue-builder.ts`)

- Secções atuais com contexto técnico: URL, rota, viewport, console, **Requests com falha**.
- Não há: linha do tempo, requests bem-sucedidas, erros de runtime estruturados, performance, ambiente/build, estado de UI (modal/tabs), bloco de privacidade explícito.

### 2.6 Sanitização (`extension/src/shared/sanitizer.ts`)

- `sanitizeUrl`: origem + pathname (sem query/hash) — alinhado a não vazar tokens em URL.
- `sanitizeElementAttributes`: denylist por nome de atributo.
- **Falta:** regex para valores (email/CPF), denylist por rota, política por domínio, redação de bodies.

### 2.7 Rede avançada / HAR (`extension/src/background/network-debugger-capture.ts`, `network-har.ts`)

- Captura CDP com duração, headers, corpos (com redação de headers conhecidos).
- Ativada por opção **`fullNetworkDiagnostic`** — ótimo como anexo, não substitui resumo leve no corpo da issue.

### 2.8 UI (`extension/src/ui/FeedbackApp.tsx`)

- `lastTarget`: elemento associado ao feedback (clique fora do shadow).
- Contexto técnico recalculado com `routeRevision` e bridge — ponto natural para **congelar snapshot** no momento “Abrir modal” vs “Enviar” (hoje parece derivado no envio; validar se convém timestamp único “momento do bug”).

---

## 3. Matriz de lacunas: PRD × implementação

| # | Tema PRD | Hoje | Lacuna principal |
|---|-----------|------|------------------|
| 1 | Timeline de ações | Não existe | Listeners + buffer + ignorar UI da extensão + mascarar inputs |
| 2 | XHR/fetch ricos | Só fetch !ok, 5 entradas | XHR, 2xx/3xx com anomalia, duração, IDs em headers, lentidão, ordem |
| 3 | Estado visual | Só screenshot + elemento alvo parcial | Modal/tab/spinner/tema/locale/zoom; snapshot DOM rico (testid, role, aria, cadeia curta) |
| 4 | Runtime ricos | Só console patch | `onerror` / `unhandledrejection`, stack, contagem, correlação temporal |
| 5 | Ambiente/sessão | UA, viewport, timestamp | Build/commit/flags só se expostos pelo host (`window.__ENV__` etc.) — contrato documentado |
| 6 | Performance | Não | PerformanceObserver (LCP, INP, CLS), Long Task API (com caveats), correlacionar com clique |
| 7 | DOM/selector | `safeAttributes` genérico | Priorizar `data-testid`, `data-qa`, role, aria-label, seletor sugerido, rect |
| 8 | Privacidade | Básica | Pipeline central, toggles por domínio, redact de payloads opcionais |
| — | Narrativa | Lista técnica plana | `IssueNarrativeBuilder`: seções como no PRD (passos, observado/esperado, evidências) |

---

## 4. Ordem de execução recomendada (PRD + dependências)

Ordem adotada (sem IA): **modelo → timeline → rede → narrativa → visual/DOM → runtime+performance → privacy hardening**.

Motivo: **timeline + rede + narrativa** dão o maior salto de valor na issue com risco controlado; **privacidade** deve endurecer antes de payloads ou opções de captura mais profundas.

---

## Phase 0: Fundação — contrato `CapturedIssueContext` + migração gradual

**Cobre:** base da “Etapa 1” do PRD.

### O que construir (fatia vertical fina)

- Definir tipo(s) versionados para os blocos do PRD (mesmo que muitos campos opcionais e vazios no início).
- `buildCapturedIssueContext` preenche `CapturedIssueContextV1`; `issue-builder` gera Markdown a partir de `capturedContext` no `CreateIssuePayload`.
- Documentar limites (N eventos, N requests) num único sítio (constantes + ADR curta em `plans/` ou comentário no topo do módulo de tipos).

### Critérios de aceite

- [ ] Tipos exportados e usados em `issue-builder` sem regressão nas secções atuais.
- [ ] Testes unitários nos tipos “shape” (ex.: fixture mínima serializável JSON).
- [ ] Nenhum aumento descontrolado de tamanho do payload (teste com snapshot grande truncado).

### Onde tocar (referência)

- `extension/src/shared/types.ts`, `context-collector.ts`, `issue-builder.ts`, testes em `*.test.ts` espelhados.

### Riscos

- Refactor grande sem entrega visível — mitigação: Phase 0 só estrutura + compatibilidade.

---

## Phase 1: Linha do tempo de interação

**Cobre:** PRD §1 + Etapa 2.

### O que construir

- No **MAIN bridge** (ou listener delegado com custo baixo): eventos significativos — `click` (target resumido), `submit`, `input`/`change` (valor mascarado por tipo/nome), `keydown` (Enter/Tab/Escape), `focus`/`blur` (opcional, cap agressivo), navegação SPA (via `history` patch ou eventos já expostos pelo host + complementar com `popstate`).
- Ring buffer 20–50; cada item: tipo, timestamp relativo/absoluto, descrição humana curta, seletor seguro.
- **Ignorar** eventos cuja origem está dentro do shadow da extensão (mesma regra mental que `elementIsInsideExtensionUi`).

### Critérios de aceite

- [ ] Abrir modal de feedback não polui a timeline.
- [ ] Inputs `password` / campos com nome suspeito não guardam valor literal.
- [ ] Markdown novo: secção `## Linha do tempo da interação` com lista numerada legível (cap de linhas).
- [ ] Testes: simular sequência de eventos no DOM de teste (Vitest + jsdom onde aplicável) ou funções puras de “evento → descrição”.

### Riscos

- Ruído em páginas muito dinâmicas — mitigação: amostragem, dedupe de cliques repetidos no mesmo alvo, limite por segundo.

---

## Phase 2: Rede — resumo rico (além de falhas)

**Cobre:** PRD §2 + Etapa 3.

### O que construir

- Estender bridge: **fetch** completo para resumo (método, URL sanitizada, status, duração ms, timestamp); marcar `aborted` quando aplicável.
- Adicionar **XHR** wrapper (open/send/onreadystatechange) com mesma estrutura de evento.
- Extrair de headers resposta (quando legíveis): `x-request-id`, `x-correlation-id` (lista configurável de nomes).
- Classificação: `error` (status >= 400 ou rede), `slow` (threshold ms configurável, ex. 3000), `nearAction` (últimas N antes do “submit issue” — definir momento de congelamento).
- Opcional (toggle nas opções): incluir **content-type** e tamanho aproximado (sem body por defeito).

### Critérios de aceite

- [ ] Issues mostram secção `## Requisições relevantes` com mistura de falhas e lentas quando existirem.
- [ ] IDs de correlação aparecem quando os headers existem (valores truncados).
- [ ] Volume limitado; URLs sem query string sensível (reutilizar/estender `sanitizeUrl`).
- [ ] Testes unitários para classificação e para merge de buffers fetch+XHR.

### Riscos

- Double-count fetch + prefetch — mitigação: dedupe por URL+method+timestamp próximo se necessário.

---

## Phase 3: Narrativa da issue (`IssueNarrativeBuilder`)

**Cobre:** PRD “Como montar a issue” + Etapa 7.

### O que construir

- Módulo dedicado que recebe `CapturedIssueContext` + texto livre do utilizador (`whatHappened`, título).
- Gera ordem de secções alinhada ao PRD: resumo (derivado ou cópia do título + primeira frase), passos prováveis (da timeline + texto), observado/esperado (campos do formulário se existirem no futuro; hoje pode mapear só “o que aconteceu”), ambiente (subset de `page`), erro principal, requests, evidências (screenshot/HAR mencionados).
- Manter **preview** editável no React sem duplicar lógica (uma função pura `buildNarrativeMarkdown`).

### Critérios de aceite

- [ ] GitHub e Jira recebem o mesmo corpo base (ou flags mínimas se Jira tiver limite).
- [ ] Secção técnica antiga ou fundida de forma documentada (evitar duplicar URL 3 vezes).
- [ ] Testes snapshot do Markdown para 2–3 cenários (com/sem timeline, com/sem rede).

### Riscos

- Issue fica longa — mitigação: caps por secção e link “detalhe técnico” colapsável no Markdown (opcional).

---

## Phase 4: Estado visual + snapshot DOM do alvo

**Cobre:** PRD §3 e §7 + Etapa 4.

### O que construir

- **Heurísticas leves** no content script ou snapshot no momento do envio: `[role="dialog"][open]`, `[aria-modal="true"]`, presença de elementos com `aria-busy="true"` ou classes comuns de spinner (lista conservadora para evitar falsos positivos).
- `tabs` / `accordion`: heurística por `aria-selected`, `role=tab`, `[data-state=active]` (documentar limitações).
- Expandir `ElementContext` ou bloco paralelo `targetElement`: `data-testid`, `data-qa`, `role`, `aria-label`, texto visível truncado, **seletor sugerido** (prioridade testid), `getBoundingClientRect` resumido.
- Tema: `prefers-color-scheme`; locale: `document.documentElement.lang`; zoom: `outerWidth/innerWidth` como hint.

### Critérios de aceite

- [ ] Nova secção `## Estado visual no momento do bug` (só quando houver dados não vazios).
- [ ] `## Elemento relacionado` com seletor sugerido quando houver testid/role útil.
- [ ] Não executar queries pesadas em DOM gigante — timeout ou limite de nós.

### Riscos

- Heurísticas frágeis entre design systems — mitigação: feature flags por “nível de intrusão” nas opções.

---

## Phase 5: Runtime enriquecido + performance contextual

**Cobre:** PRD §4 e §6 + Etapa 5.

### O que construir

- `window.addEventListener('error')` e `unhandledrejection` no bridge: mensagem, stack, arquivo:linha se disponível, timestamp, contador de repetições (dedupe por mensagem+stack primeiros N chars).
- `PerformanceObserver`: LCP, INP (quando suportado), layout-shift para CLS acumulado; registar valores “observados na sessão” com timestamps.
- Long tasks: `PerformanceObserver` `longtask` se disponível; senão omitir com documentação.
- Correlacionar “último erro” com “último clique” da timeline (delta ms) — campo simples no modelo.

### Critérios de aceite

- [ ] Secções `## Erro de runtime principal` e `## Sinais de performance` quando houver dados.
- [ ] Não duplicar erros já vistos no console se forem o mesmo evento (dedupe).
- [ ] Degradação graciosa em browsers sem APIs (Safari gaps).

### Riscos

- PerformanceObserver pode ter custo — mitigação: desregistar ao descarregar; limitar duração da sessão de observação à vida do bridge.

---

## Phase 6: Pipeline de privacidade e controles

**Cobre:** PRD §8 + Etapa 6.

### O que construir

- Função `applyPrivacyPolicy(context): CapturedIssueContext` aplicada **antes** de guardar estado volátil e antes de `buildIssueBody`.
- Redação: headers (lista), regex para email/CPF em strings de timeline e mensagens, opção **safe mode** por hostname (menos dados).
- **Toggles** em `ExtensionSettings`: captura estendida de console, incluir payloads resumidos, timeline on/off, performance on/off.
- Documentar no `DOCUMENTATION.md` o que é coletado em cada modo.

### Critérios de aceite

- [ ] Com safe mode, timeline e bodies não aparecem mesmo que implementados.
- [ ] Testes unitários com strings que contêm email e tokens fictícios.
- [ ] Paridade conceitual com `HAR_REDACTED_HEADER_NAMES` (uma lista partilhada ou import).

### Riscos

- Regex de PII com falsos positivos — mitigação: conservador + opt-in para padrões agressivos.

---

## 5. Testes e qualidade transversais

- **Unitário:** `issue-builder`, narrative builder, sanitização, classificação de rede, formatação de timeline.
- **Integração leve:** content script + bridge em página de teste (se o projeto já tiver padrão).
- **Manual:** SPA (React Router), app com XHR-only, página com muitos cliques, Jira com HAR ligado.
- **Regressão:** tamanho máximo do body Jira/GitHub (caracteres); truncagem explícita nos testes.

---

## 6. Definição de pronto (por entrega incremental)

Cada phase está “pronta” quando:

1. Funcionalidade visível na issue **ou** no preview do modal.  
2. Testes automatizados cobrem o comportamento novo principal.  
3. `DOCUMENTATION.md` menciona dados novos e riscos de privacidade quando aplicável.  
4. Não aumenta permissões MV3 sem justificativa (novas permissões = revisão explícita no plano).

---

## 7. Checklist rápido de alinhamento com o PRD

- [ ] Timeline automática com buffer e masking  
- [ ] Rede: fetch + XHR, duração, IDs, lentas, erros  
- [ ] Estado visual + DOM rico do alvo  
- [ ] Runtime: erro + promise rejection com stack  
- [ ] Ambiente: extensível via convenções do host (documentar)  
- [ ] Performance: Web Vitals + long tasks quando possível  
- [ ] Privacidade: pipeline + toggles  
- [ ] Issue: narrativa estruturada, não só dumps  

---

## 8. Próximo passo operacional

1. Revisão contigo: granularidade das phases (fundir 0+1 ou partir Phase 2 em “fetch” e “XHR”).  
2. Abrir **uma branch** por phase (ou por par timeline+rede) para PRs pequenos.  
3. Começar por **Phase 0** para não acumular dívida de tipos.

Se quiseres, no passo seguinte posso transformar **uma** phase (ex. Phase 1) em `tasks.md` com tarefas ordenadas estilo TDD (testes primeiro).
