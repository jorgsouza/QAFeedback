# Plano: contexto rico para issues (PRD `PRD/features.md`)

> **Fonte:** `PRD/features.md` — oito eixos (timeline, rede, estado visual, runtime, ambiente, performance, DOM, privacidade) + narrativa da issue. **Fora de âmbito por agora:** qualquer etapa do PRD sobre IA / sugestões automáticas de título ou triagem.  
> **Objetivo:** evoluir a extensão QA Feedback de “contexto técnico básico” para um **relato estruturado e seguro**, alinhado ao PRD, sem despejar telemetria crua.

---

## Progresso (alto nível)

| Phase | Tema | Estado |
|-------|------|--------|
| **0** | Contrato `CapturedIssueContextV1`, `capturedContext`, `context-limits.ts` | **Feito** (`feature/captured-issue-context-phase0`) |
| **1** | Linha do tempo (`interaction-timeline`, `page-bridge`) | **Feito** |
| **2** | Rede resumida fetch + XHR, duração, IDs, secção Markdown | **Feito** |
| **3** | Narrativa (`IssueNarrativeBuilder`) | Pendente |
| **4** | Estado visual + DOM alvo | Pendente |
| **5** | Runtime + performance | Pendente |
| **6** | Privacidade / toggles | Pendente |

**Branch de trabalho:** `feature/captured-issue-context-phase0` (histórico de commits Phase 0–2).

---

## 1. Decisões de arquitetura (duráveis)

Estas decisões devem guiar todas as fases; revisar só com motivo forte.

| Decisão | Escolha proposta | Notas |
|--------|-------------------|--------|
| **Onde corre a coleta “pesada”** | MAIN world (`page-bridge`) + content script (UI / shadow) + opcionalmente service worker (CDP/HAR já existente) | Manter uma única fonte de verdade em memória na página; SW só para o que a página não vê (HAR). |
| **Formato interno** | Um único objeto versionado (ex. `CapturedIssueContext` v1) com sub-blocos: `session`, `page`, `uiState`, `interactionTimeline`, `network`, `runtimeErrors`, `performance`, `privacyMeta` | Hoje: `TechnicalContextPayload` + `version: 1`; rede rica em `networkRequestSummaries`. |
| **Limites padrão** | Ring buffers: timeline 20–50 eventos; rede “resumo” 15–30 entradas; console/erros com cap por nível; payloads truncados | Valores em `extension/src/shared/context-limits.ts`. |
| **Rede sem HAR** | Resumo via monkey-patch **fetch** + **XMLHttpRequest** no bridge; classificar erro / lento / “perto do submit” | HAR (CDP) continua **opcional** (`fullNetworkDiagnostic`); corpo da issue: `## Requisições relevantes`. |
| **Privacidade** | Pipeline único: **sanitizar antes** de guardar no estado e antes de gerar Markdown/anexos | Expandir `sanitizer.ts` e reutilizar padrões do `redactHarRoot` (headers sensíveis). |
| **Narrativa** | Camada `IssueNarrativeBuilder` (ou evolução de `issue-builder.ts`) que consome o modelo enriquecido e gera seções estáveis para GitHub/Jira | Separar “payload bruto” (debug) de “texto da issue” (leitura humana), mesmo que no MVP só exista o segundo. |

---

## 2. Inventário: o que o código faz hoje (atualizado)

### 2.1 Modelo (`extension/src/shared/types.ts`)

- **`CapturedIssueContextV1`**: `page`, `element?`, `interactionTimeline?`, **`networkRequestSummaries?`** (Phase 2), `console`, `failedRequests` (derivado dos summaries escolhidos para compatibilidade / legado).
- **`NetworkRequestSummaryEntryV1`**: método, URL sanitizada, status, `durationMs`, `aborted?`, IDs de correlação, `responseContentType?`.
- **`FailedRequestEntry`**: ainda usado quando não há `networkRequestSummaries` no payload (ex.: testes legados).

### 2.2 `page-bridge.ts` (MAIN world)

- Console, **fetch** (todas as conclusões + erros rede), **XHR** (`open`/`send` + `loadend`), linha do tempo (Phase 1).
- Emite `CustomEvent` com `networkSummaries`; bridge antigo só com `failedRequests` ainda é aceite no `context-collector` (síntese temporária).

### 2.3 `context-collector.ts` + `network-summary.ts`

- `pickNetworkSummariesForIssue`: prioridade erro → lenta (≥ `networkSlowThresholdMs`) → restantes; dedupe método+URL+status.
- `buildCapturedIssueContext` sanitiza URLs, trunca strings, preenche `networkRequestSummaries` e `failedRequests`.

### 2.4 `issue-builder.ts`

- `## Requisições relevantes` quando há summaries; senão `## Requests com falha`.
- Schema de contexto na issue: **Phase 2** (texto visível para validar build).

### 2.5–2.8

- Rota SPA, HAR/CDP, UI modal: inalterados neste plano; ver commits anteriores.

---

## 3. Matriz de lacunas: PRD × implementação (atualizado)

| # | Tema PRD | Estado |
|---|-----------|--------|
| 1 | Timeline de ações | **Coberto** (Phase 1) |
| 2 | XHR/fetch ricos | **Coberto** (Phase 2): duração, status, IDs quando legíveis; opacos → status 0 |
| 3 | Estado visual | Pendente (Phase 4) |
| 4 | Runtime ricos | Pendente (Phase 5) |
| 5 | Ambiente/sessão | Pendente |
| 6 | Performance | Pendente (Phase 5) |
| 7 | DOM/selector | Pendente (Phase 4) |
| 8 | Privacidade | Pendente (Phase 6) |
| — | Narrativa | Pendente (Phase 3) |

---

## 4. Ordem de execução recomendada (PRD + dependências)

Ordem adotada (sem IA): **modelo → timeline → rede → narrativa → visual/DOM → runtime+performance → privacy hardening**.

**Próximo passo sugerido:** **Phase 3 — Narrativa** (`IssueNarrativeBuilder` ou refactor de `issue-builder`).

---

## Phase 0: Fundação — contrato `CapturedIssueContext` + migração gradual

**Estado:** **concluído** — `CapturedIssueContextV1`, `capturedContext`, `context-limits.ts`, testes de forma/ tamanho.

### Critérios de aceite

- [x] Tipos exportados e usados em `issue-builder` sem regressão nas secções atuais.
- [x] Testes unitários nos tipos “shape” (ex.: fixture mínima serializável JSON).
- [x] Nenhum aumento descontrolado de tamanho do payload (teste com snapshot grande truncado).

---

## Phase 1: Linha do tempo de interação

**Estado:** **concluído** — `interaction-timeline.ts`, listeners + history patch no `page-bridge`, `## Linha do tempo da interação`.

### Critérios de aceite

- [x] Abrir modal de feedback não polui a timeline (filtro `#qa-feedback-extension-root`).
- [x] Inputs sensíveis não guardam valor literal.
- [x] Markdown: `## Linha do tempo da interação`.
- [x] Testes (`interaction-timeline.test.ts`, `issue-builder`).

---

## Phase 2: Rede — resumo rico (além de falhas)

**Estado:** **concluído** — `network-summary.ts`, `fetch`/`XHR` no bridge, `networkRequestSummaries`, `## Requisições relevantes`, compat. `failedRequests` / bridge legado.

### O que foi entregue

- Resumo por pedido: método, URL (sanitizada no collector), status, duração ms, `aborted` em `AbortError`.
- Cabeçalhos de resposta quando legíveis: `x-request-id`, `x-correlation-id`, `x-amzn-requestid`, `request-id`, `correlation-id`; `content-type` resumido.
- Limite na issue: `issueNetworkSummaryMax` (20); buffer bridge: `bridgeNetworkBuffer` (50); lenta ≥ `networkSlowThresholdMs` (3000).
- Classificação na linha Markdown: `**erro**`, `**lenta**`.

### Critérios de aceite

- [x] Secção `## Requisições relevantes` com erros e lentas priorizados.
- [x] IDs de correlação quando existem (truncados).
- [x] URLs sem query na issue (`sanitizeUrl`).
- [x] Testes: `network-summary.test.ts` + `issue-builder` (relevantes vs fallback falha).

### Não incluído nesta fase (futuro)

- Toggle nas opções para corpo de payload / tamanho aproximado obrigatório.
- Marcação explícita “nearAction” temporal vs envio da issue (pode usar último snapshot).

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

- **Unitário:** `issue-builder`, `network-summary`, `interaction-timeline`, sanitização.
- **Manual:** SPA, XHR-only, Jira com HAR ligado, pedidos cross-origin (status 0).

---

## 6. Definição de pronto (por entrega incremental)

1. Funcionalidade visível na issue **ou** no preview do modal.  
2. Testes automatizados cobrem o comportamento novo principal.  
3. `DOCUMENTATION.md` menciona dados novos e riscos de privacidade quando aplicável.  
4. Não aumenta permissões MV3 sem justificativa.

---

## 7. Checklist rápido de alinhamento com o PRD

- [x] Timeline automática com buffer e masking  
- [x] Rede: fetch + XHR, duração, IDs, lentas, erros  
- [ ] Estado visual + DOM rico do alvo  
- [ ] Runtime: erro + promise rejection com stack  
- [ ] Ambiente: extensível via convenções do host (documentar)  
- [ ] Performance: Web Vitals + long tasks quando possível  
- [ ] Privacidade: pipeline + toggles  
- [ ] Issue: narrativa estruturada, não só dumps  

---

## 8. Próximo passo operacional

1. **Phase 3** — `IssueNarrativeBuilder` (ou extrair de `issue-builder`) com testes snapshot.  
2. Opcional: marcar “nearAction” na rede com timestamp do último clique da timeline.  
3. Opcional: toggles em opções para limite de linhas de rede / threshold de lentidão.

Se quiseres, no passo seguinte posso transformar **Phase 3** em `tasks.md` com tarefas TDD.
