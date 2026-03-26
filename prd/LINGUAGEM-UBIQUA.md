# Linguagem ubíqua — QAFeedback

Documento em **português do Brasil (pt-BR)**.

Vocabulário **compartilhado** entre produto, QA, suporte e engenharia. Objetivo: falar da mesma coisa com os **mesmos termos** no UI, nas issues, nos PRDs e no código (nomes estáveis aparecem em `tipo_código` quando úteis).

**Manutenção:** ao introduzir conceito novo na UI ou no contrato de contexto (`CapturedIssueContextV1`, etc.), atualize este arquivo em uma linha.

---

## 1. Núcleo do domínio

| Termo (produto) | Significado | No código / notas |
|-----------------|-------------|-------------------|
| **Feedback (QA)** | Registro de um problema ou observação feito **a partir da página em teste**, com texto e opcionalmente contexto técnico, para **GitHub** e/ou **Jira**. | Fluxo disparado pelo usuário no painel; payload `CreateIssuePayload`. |
| **Issue** | **Registro** criado no sistema de destino: **GitHub Issue** ou **issue/ticket no Jira** (tipo efetivo pode ser Bug, Task, etc., conforme o quadro). | Não confundir com “problema” genérico — aqui é o **artefato** no GitHub/Jira. |
| **Destino** | Sistema para onde o envio vai: **GitHub**, **Jira** ou **ambos** no mesmo envio. | `sendToGitHub` / `sendToJira` no formulário. |
| **Chamado** (coloquial) | No dia a dia de QA, às vezes usado como sinônimo de **ticket Jira** ou **pedido registrado**; na documentação técnica preferimos **issue** ou **ticket Jira**. | — |
| **Contexto técnico** | Bloco opcional de dados sobre a **página e a sessão** (URL, timeline, rede, erros, etc.) anexado à descrição em Markdown. | `includeTechnicalContext`; agregado em `CapturedIssueContextV1`. |
| **Contexto capturado** | **Contrato versionado** (`version: 1`) com tudo o que pode ir para a issue após sanitização e modos. | `CapturedIssueContextV1` estende `TechnicalContextPayload`. |
| **Rascunho** | Título, descrição e opções do formulário **antes** do envio; pode permanecer ao recolher o painel. | Estado local +, em parte, `chrome.storage.session` por aba. |

---

## 2. Interface na página

| Termo | Significado | No código / notas |
|-------|-------------|-------------------|
| **FAB** | *Floating Action Button* — botão flutuante que abre o fluxo de feedback. | `#qa-feedback-extension-root` / UI sombra. |
| **Painel** | Folha (**sheet**) à direita com **Formulário** e **Preview**; diferente de um “modal” genérico do site. | `FeedbackApp`, Shadow DOM. |
| **Recolher** | Esconder o painel **sem** perder o rascunho; o FAB continua disponível. | — |
| **Preview** | Vista do **Markdown** que será enviado (ou base do ADF no Jira). | Aba **Preview** no painel. |
| **Opções** | Página de configuração da extensão (tokens, domínios, quadro, modo diagnóstico, modo de captura). | `options.html` / `OptionsApp`. |
| **Domínios permitidos** | Lista de **hostnames** onde o FAB pode ser injetado (e onde o Chrome pode pedir permissão). | `allowedHosts` em `ExtensionSettings`. |

---

## 3. Mundo da página vs extensão

| Termo | Significado | No código / notas |
|-------|-------------|-------------------|
| **Page bridge** | Script injectado no **MAIN world** da página: observa DOM, rede, console e emite **snapshots** para o content script. | `page-bridge.ts` → bundle `page-bridge.js`. |
| **Snapshot (bridge)** | Recorte coerente do estado observado no bridge **naquele documento** (timeline parcial, rede, etc.). | Evento `qa-feedback:snapshot`; `latestBridge` no collector. |
| **Content script** | Código da extensão no **isolated world** — não vê variáveis da página; comunica com bridge via DOM/`CustomEvent` e com o **service worker** via mensagens. | `content.tsx`. |
| **Service worker (SW)** | Processo em background MV3: tokens, APIs GitHub/Jira, armazenamento de **sessão de timeline** por aba, HAR, etc. | `service-worker.ts`. |
| **UI da extensão** | Raiz conhecida para ignorar cliques na timeline (`#qa-feedback-extension-root`). | `TIMELINE_IGNORE_HOST_ID` / constantes. |

---

## 4. Linha do tempo e sessão

| Termo | Significado | No código / notas |
|-------|-------------|-------------------|
| **Linha do tempo (de interação)** | Lista ordenada de eventos relevantes (clique, navegação, input, scroll, …) para narrar **o que o QA fez**. | `InteractionTimelineEntryV1`; `kind` em `InteractionTimelineKindV1`. |
| **Âncora (temporal)** | Último evento “forte” na timeline (ex.: clique, submit, navegação) usado para **correlação** com rede/erros — **não implica causalidade**. | `deltaToLastActionMs`, `isCorrelated` em resumos de rede. |
| **Sessão de timeline (por aba)** | Acumulado no SW de eventos **ao longo de várias URLs na mesma aba**, para não perder histórico quando o documento muda. | Mensagens `QAF_TIMELINE_*`; `timeline-session-store.ts`. |
| **Append (timeline)** | Envio **incremental** de entradas novas ao SW após comparar snapshots. | `QAF_TIMELINE_APPEND`; `timeline-append-queue.ts`. |
| **Consolidação no submit** | Leitura da timeline da sessão + fusão com o snapshot **atual** antes dos limites de exibição. | `QAF_TIMELINE_GET_FOR_SUBMIT`. |

---

## 5. Rede, console e erros

| Termo | Significado | No código / notas |
|-------|-------------|-------------------|
| **Requisições relevantes** | Subconjunto de pedidos HTTP (fetch/XHR) escolhido para a issue: prioridade a **falhas** e **lentos**. | `networkRequestSummaries`; seção Markdown “Requisições relevantes”. |
| **Resumo de rede** | Uma linha por pedido: método, URL sanitizada, status, duração, IDs de correlação quando existem. | `NetworkRequestSummaryEntryV1`. |
| **URL sanitizada** | URL **sem query nem hash** na exposição típica ao Markdown (reduz vazamento de dados na URL). | Campo `url` no resumo. |
| **Pedido falhado** (legado / console) | Entrada simples associada a falhas ainda útil quando não há resumo completo. | `FailedRequestEntry`. |
| **Erro de runtime principal** | Erro ou `unhandledrejection` destacado na issue com stack quando permitido pelo modo. | `RuntimeErrorSnapshotV1`. |
| **Sinais de performance** | LCP, INP, CLS, long tasks (best-effort, depende do browser). | `PerformanceSignalsSnapshotV1`. |
| **Modo diagnóstico completo** | Opção que ativa captura **HAR** (CDP) e anexo ao Jira, com redação de cabeçalhos sensíveis. | `fullNetworkDiagnostic`; permissão `debugger`. |
| **HAR** | Arquivo JSON de registro HTTP para importar no DevTools; complementar aos **resumos** na issue. | Anexo Jira; `network-har.ts`. |

---

## 6. Estado visual e alvo

| Termo | Significado | No código / notas |
|-------|-------------|-------------------|
| **Estado visual** | Diálogos/modais visíveis, busy, abas internas (role=tab) no momento do envio. | `VisualStateSnapshotV1`. |
| **Elemento relacionado / alvo** | Dicas sobre o elemento em foco ou clicado (selector, role, texto). | `ElementContext`, `TargetDomHintV1`. |
| **Indício de vista** | Heurística **desktop / móvel / possível emulação DevTools** — não há API oficial para o toggle de dispositivo. | `viewModeHint` em `page`. |

---

## 7. Ambiente da aplicação e segurança (heurísticas)

| Termo | Significado | No código / notas |
|-------|-------------|-------------------|
| **Ambiente da aplicação** | Metadados best-effort (build, tenant, flags) quando a página expõe sinais. | `AppEnvironmentSnapshotV1`. |
| **Achado sensível** | Resultado **heurístico** sobre dados já capturados (token, PII, mixed content, etc.) — **não** é confirmação de vulnerabilidade. | `SensitiveFindingV1`; `kind` em `SensitiveFindingKindV1`. |
| **Modo de captura** | **Debug interno** (mais texto bruto na issue) vs **produção sensível** (truncagem adicional); a **detecção** de achados corre sobre contexto completo antes de aplicar o modo. | `CaptureModeV1`: `debug-interno` \| `producao-sensivel`. |
| **Correlação** | Proximidade temporal entre timeline, rede e erros — **não** afirma que A causou B. | `session-correlation.ts`. |

---

## 8. Rota e labels (SPA)

| Termo | Significado | No código / notas |
|-------|-------------|-------------------|
| **Rota técnica** | `pathname` (+ query quando aplicável) para identificar o site na página. | `TechnicalContextPayload.page`. |
| **Slug de rota** | Identificador curto estável para UI (ex.: `ra-notifications`). | `routeSlug`. |
| **Rótulo de rota** | Nome legível para humanos (ex.: “Home”). | `routeLabel`. |

---

## 9. GitHub e Jira

| Termo | Significado | No código / notas |
|-------|-------------|-------------------|
| **Alvo (repo)** | Repositório GitHub destino (`owner/repo`). | `RepoTarget`. |
| **Quadro Software** | Board Jira Agile usado para contexto de projeto / filtro JQL. | `jiraSoftwareBoardId`. |
| **Allowlist de quadros** | Lista de IDs de quadro **embebida no build** para limitar escolhas na UI. | `BOARD_ID` / `VITE_JIRA_BOARD_ALLOWLIST`. |
| **Motivo da abertura** | Campo de negócio (Bug/Sub-Bug) mapeado para custom field ou texto na descrição. | `jiraMotivoAbertura`, `JIRA_MOTIVO_ABERTURA_OPTIONS`. |
| **Tipo na criação** | Tipo de issue **efetivo** na API (pode ser **Task** se o JQL do quadro não admitir Bug). | Resolução em `jira-board-filter-resolve.ts`. |
| **ADF** | *Atlassian Document Format* — descrição rica no Jira convertida a partir do Markdown. | `jira-markdown-adf.ts`. |
| **Anexo (imagem)** | PNG enviado após criar a issue (arquivos, clipboard, captura por região). | `JiraImageAttachmentPayload`. |

---

## 10. Armazenamento e filas (Chrome)

| Termo | Significado | No código / notas |
|-------|-------------|-------------------|
| **`chrome.storage.local`** | Preferências, tokens, listas de repos — **persistente**. | `qaFeedbackSettings`. |
| **`chrome.storage.session`** | Dados **efémeros** por janela/sessão do browser: espelho da timeline, UI por aba, imagens pendentes. | Chaves `qafTabUiV1_*`, pending images, timeline mirror. |
| **Fila de append** | Serializa envios `QAF_TIMELINE_APPEND` para não perder eventos em rajada. | `timeline-append-queue.ts`. |
| **Mensagens ao SW** | Comunicação `chrome.runtime.sendMessage` com tipos estáveis (`CREATE_ISSUE`, `QAF_TIMELINE_*`, …). | Ver tabela em [extension/DOCUMENTATION.md](../extension/DOCUMENTATION.md#mensagens-do-service-worker). |

---

## 11. Narrativa

| Termo | Significado | No código / notas |
|-------|-------------|-------------------|
| **Resumo / leitura rápida** | Texto derivado do contexto para humanos lerem antes do bloco técnico longo. | `issue-narrative.ts` / seções na issue. |

---

## Referências

- Contratos: `extension/src/shared/types.ts`
- PRD de timeline multi-URL: [PRD-010-linha-tempo-continua/prd.md](PRD-010-linha-tempo-continua/prd.md)
- PRD de maturidade / modos / achados: [PRD-011-maturidade-produto/plan.md](PRD-011-maturidade-produto/plan.md)
- Guia técnico: [extension/DOCUMENTATION.md](../extension/DOCUMENTATION.md)
