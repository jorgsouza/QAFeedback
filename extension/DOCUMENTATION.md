# Documentação — QA Feedback → GitHub e Jira

Extensão **Chrome Manifest V3**: botão flutuante (FAB), modal em **Shadow DOM** com **Formulário** / **Preview**, envio para **GitHub** e/ou **Jira Cloud**. Tokens e chamadas às APIs rodam no **service worker**; o content script não recebe PAT nem API token do Jira.

---

## Índice

1. [Instalação para desenvolvimento](#instalação-para-desenvolvimento)
2. [Configuração (opções)](#configuração-opções)
3. [Uso no dia a dia (modal)](#uso-no-dia-a-dia-modal)
4. [Voz (Chrome) e ditado do SO](#voz-chrome-e-ditado-do-so)
5. [Permissões](#permissões)
6. [Resolução de problemas](#resolução-de-problemas)
7. [Arquitetura e arquivos](#arquitetura-e-arquivos)
8. [Mensagens do service worker](#mensagens-do-service-worker)
9. [page-bridge e “erros” da extensão](#page-bridge-e-erros-da-extensão)
10. [Ícones (arte circular)](#ícones-arte-circular)
11. [Jira: quadro no modal, allowlist e tipo Bug → Task](#jira-quadro-no-modal-allowlist-e-tipo-bug--task)
12. [Linha do tempo contínua (mesma aba)](#linha-do-tempo-contínua-mesma-aba)
13. [Referência rápida de scripts](#referência-rápida-de-scripts)

---

## Instalação para desenvolvimento

**Requisitos:** Node.js 18+.

```bash
cd extension
npm install
npm run build
```

- Saída: **`extension/dist/`**.
- **chrome://extensions** → Modo do desenvolvedor → **Carregar descompactada** → escolha **`extension/dist`**.
- Depois de mudanças no código: `npm run build` e **Recarregar** na extensão.

O `build` **executa** **`npm run icons`** (lê **`../prd/assets/capiQA.png`**, máscara circular → `public/qa.png` e `public/icons/icon*.png`).

---

## Configuração (opções)

Abra as opções pelo menu da extensão, **chrome://extensions**, ou **Configurações** no modal.

### GitHub

| Campo | Descrição |
|--------|-----------|
| **GitHub token** | PAT classic ou **fine-grained** com **Issues** (read/write) nos repositórios desejados. |
| **Testar conexão e listar repos** | Valida o token e preenche a lista de repositórios. Depois **Salvar** para persistir hosts/repos. |
| **Repositórios destino** | Uma linha por repo: `owner/repo`, URL ou `owner/repo\|Nome no menu`. |
| **Domínios permitidos** | Hostnames (ex.: `localhost`). Ao **Salvar**, o Chrome pode pedir permissão para hosts novos. |

### Jira Cloud (Atlassian)

| Campo | Descrição |
|--------|-----------|
| **E-mail Atlassian** | Mesmo e-mail da conta Jira. Com domínio **@empresa** (não Gmail genérico), o site em geral é inferido como `https://empresa.atlassian.net`. |
| **API token Jira** | Criado em [id.atlassian.com/.../api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens). |
| **Quadro Software — backlog destino** | **Menu (`<select>`)**. Depois de e-mail + token válidos (e site resolvível), a **lista de quadros carrega automaticamente** (debounce ~550 ms), sem botão de teste. |
| **Ao escolher um quadro** | A extensão confirma a conexão, lê a **chave do projeto** e o **filtro do quadro** (campos como Squad quando existirem) e **salva** em `chrome.storage.local` — equivalente ao antigo “testar e listar”. |
| **Tipo na criação vs opções** | Se o **JQL do filtro do quadro** não incluir o tipo configurado (ex.: só **Task**) mas nas opções estiver **Bug**, o estado de teste pode mostrar: *Tipo na criação neste quadro: Task (nas opções: Bug)* — é o comportamento esperado antes de enviar feedback. |

**Allowlist de quadros (build):** em `extension/.env` ou na raiz do repositório, `BOARD_ID=id1,id2` ou `VITE_JIRA_BOARD_ALLOWLIST=…`. Lista **vazia** = sem filtro (todos os quadros a que a conta tem acesso). Só **IDs** entram no bundle; **nunca** coloque API tokens no `.env` que vá para o `dist/`.

**Avançado** (opcional): URL manual do site, chave de projeto, overrides de campo select do filtro — só quando a inferência não basta.

**Página de opções (`options.html`):** ícones em `<link rel="icon">` apontam para `public/icons/icon*.png` (melhor nitidez no separador do Chrome quando a página abre em aba).

### Armazenamento

Configurações e tokens em **`chrome.storage.local`** (`qaFeedbackSettings`). Uso só no **background** para criar issues e listar repos/quadros.

---

## Uso no dia a dia (modal)

1. Site com host permitido e permissão concedida (ou **clique no ícone** da extensão se estiver “ao clicar”).
2. **FAB** → painel (sheet à direita); **seta** no cabeçalho recolhe o painel mantendo o rascunho; **FAB** reabre.
3. **Destino**: GitHub, Jira ou ambos (só aparecem destinos com token nas opções).
4. **Faixa de estado** (topo do formulário): à **esquerda**, chip com **slug + pathname** (ex.: `ra-notifications /minha-conta/notificacoes`) — ver `page-route-context.ts`; paths sem regra explícita geram slug `ra-…` a partir dos segmentos. Atualiza em **SPA**. Tooltip repete slug+path e acrescenta **query** se existir. Com **contexto técnico**, o Markdown inclui **Rota técnica** + rótulo PT + path. À **direita**, bolinhas / ícone ℹ️ / banner de rede.
5. **Jira**: **Board do Jira para vincular** (obrigatório quando Jira está ativo) — lista igual à das opções, respeitando a allowlist de build se existir; preencher **Motivo da abertura**; **prints** (botão ou Ctrl+V na descrição, com limites).
6. **Título** / **O que aconteceu**; **microfone** para voz no Chrome (veja a seção seguinte).
7. **Preview** → **Enviar** (o payload pode incluir o **ID do quadro** escolhido no passo 5). Com **Incluir contexto técnico**, o Markdown reflete também **Resumo** / leitura rápida, linha do tempo, requisições relevantes, estado visual, elemento relacionado, erro de runtime e sinais de performance **quando houver dados** (ver [page-bridge](#page-bridge-e-erros-da-extensão)).

---

## Voz (Chrome) e ditado do SO

- **Web Speech API** (`webkitSpeechRecognition`): idioma **`pt-BR` por padrão** (mesmo com Chrome em inglês); respeita entradas `pt-*` em `navigator.languages` se existirem.
- Exige **HTTPS** (`isSecureContext`). O áudio é processado pelo **serviço do Chrome/Google**, não pela extensão.
- Nas dicas dos campos, há referência ao **ditado nativo** (ex.: Win+H) como alternativa.

---

## Permissões

- **`storage`**, **`scripting`**, **`activeTab`** — configurações, registro/injeção do content script quando necessário.
- **`host_permissions` fixas:** `api.github.com`, **`*.atlassian.net`**, localhost / 127.0.0.1.
- **`optional_host_permissions`** `http(s)://*/*` — pedido ao **Salvar** conforme os domínios listados nas opções.

---

## Resolução de problemas

### Extension context invalidated

Você recarregou a extensão sem dar **F5** na **aba** do site. Atualize a página. Veja também `extension-runtime.ts`.

### Botão não aparece

Igual ao fluxo GitHub: permissão “ler dados do site”, domínio nas opções, não usar `chrome://` / Web Store para o FAB.

### Jira: 401 / lista de quadros vazia

Token revogado, e-mail errado ou conta sem acesso **Jira Software** / API Agile. Confira o site (e-mail `@empresa` ou URL em Avançado).

### Voz sempre em inglês (comportamento corrigido no código)

O reconhecedor usa `lang` **pt-BR** por padrão; recarregue a extensão depois de atualizar.

### Página “Errors” da extensão com `page-bridge.js`

Muitas entradas são **avisos da própria página** (ex.: scripts de analytics) que passam por `console.warn` **interceptado** pelo bridge — não são falhas da extensão. Veja [page-bridge e “erros”](#page-bridge-e-erros-da-extensão).

### 401 / 403 GitHub

Token ou escopos Issues (fine-grained) incorretos.

### Jira: issue criada mas “não associada ao quadro” / erro de backlog

- Mensagens como *Tried to move to backlog on board without backlog* referem-se a quadros **Kanban** ou **sem backlog** na API: o código trata o caso conhecido; se ainda falhar, verifique se o **tipo de issue** da criação entra no **filtro JQL** do quadro (a extensão passa de **Bug** para **Task** quando o filtro permite Task e não Bug).
- Confirme **Board do Jira para vincular** no modal e o **ID** na allowlist (se usar `BOARD_ID`).

---

## Arquitetura e arquivos

| Área | Caminho |
|------|---------|
| Entrada content | `src/content/content.tsx` |
| UI modal + FAB | `src/ui/FeedbackApp.tsx`, `src/ui/shadow-styles.ts` |
| Voz (hook) | `src/ui/useChromeSpeechDictation.ts`, `src/shared/chrome-speech-dictation.ts` |
| Opções | `src/options/OptionsApp.tsx`, `options.html` |
| Service worker | `src/background/service-worker.ts` |
| GitHub | `src/shared/github-client.ts` |
| Jira | `src/shared/jira-client.ts`, `jira-board-filter-resolve.ts`, `jira-board-allowlist.ts`, `jira-boards-list-for-feedback.ts`, `jira-motivo.ts` (`jiraMotivoCustomFieldApiValue`: array `[{ value }]` para multi-select/checkboxes no Jira Cloud) |
| Imagens Jira | `src/shared/feedback-image-utils.ts` |
| Corpo da issue | `src/shared/issue-builder.ts` |
| Narrativa (Resumo / leitura rápida) | `src/shared/issue-narrative.ts` |
| Jira: Markdown → ADF | `src/shared/jira-markdown-adf.ts` |
| Limites de captura (buffers, caps) | `src/shared/context-limits.ts` |
| Linha do tempo / rede (helpers) | `src/shared/interaction-timeline.ts`, `src/shared/network-summary.ts` |
| Timeline **sessão por aba** (SW + storage) | `src/shared/timeline-session-store.ts`, `src/background/timeline-tab-session.ts`, `src/shared/timeline-append-queue.ts` |
| Contexto / injeção | `src/shared/context-collector.ts`, `src/injected/page-bridge.ts` |
| Achados sensíveis (heurísticas) | `src/shared/sensitive-findings.ts` |
| Modo de captura (debug vs produção sensível) | `src/shared/capture-mode.ts` |
| Correlação temporal (rede / erros ↔ timeline) | `src/shared/session-correlation.ts` |
| Metadados da aplicação (ambiente) | `src/shared/app-environment-capture.ts` |
| Estado da UI por aba (`chrome.storage.session`) | `src/shared/feedback-ui-session.ts` |
| Imagens pendentes por aba (sessão) | `src/shared/pending-images-session.ts` |
| Fila de mensagens ao SW (best-effort) | `src/shared/extension-message-queue.ts` |
| Ditado SO (textos) | `src/shared/native-dictation-hint.ts` |
| Rota da página (rótulo + SPA) | `src/shared/page-route-context.ts`, `location-subscription.ts` |
| Storage / tipos | `src/shared/storage.ts`, `types.ts` |
| Runtime da extensão | `src/shared/extension-runtime.ts` |
| HAR / captura CDP | `src/shared/network-har.ts`, `network-har-jira-help.ts`, `src/background/network-debugger-capture.ts` |
| Captura por região | `src/shared/region-screenshot-crop.ts`, `src/content/region-picker-overlay.ts`, `region-screenshot-flow.ts` |

---

## Mensagens do service worker

`chrome.runtime.sendMessage` / listener no `service-worker.ts`:

| Tipo | Uso |
|------|-----|
| `LIST_REPO_TARGETS` | UI do feedback: repos, flags token GitHub/Jira, **`fullNetworkDiagnostic`**, e com Jira ligado **`jiraBoards`** / **`jiraDefaultBoardId`**: lista **todos** os quadros Software visíveis ao token, depois filtro **`builtInJiraBoardAllowlistIds()`** se o build tiver allowlist (igual à validação em **`CREATE_ISSUE`**). |
| `OPEN_OPTIONS` | Abre a página de opções. |
| `CREATE_ISSUE` | Cria issue GitHub e/ou Jira conforme o payload (com `sender.tab` para consumir HAR no Jira). Opcional **`jiraSoftwareBoardId`** no payload: escolha explícita do modal — **sem fallback silencioso** para o quadro das opções se o ID não estiver na lista permitida (erro claro). Em sucesso com Jira, pode devolver **`jiraSoftwareBoardIdUsed`**. |
| `START_NETWORK_DIAGNOSTIC` | Com opção ativa: anexa CDP à aba do remetente e inicia `Network.enable`. |
| `STOP_NETWORK_DIAGNOSTIC` | Desliga o depurador na aba do remetente (cancelar/fechar modal). |
| `CAPTURE_VISIBLE_TAB` | Devolve `dataUrl` PNG do viewport (`chrome.tabs.captureVisibleTab(windowId, …)` — usa `sender.tab.windowId`, não `tabId`). |
| `TEST_GITHUB` | Valida PAT e lista repos (as opções podem mandar o token no corpo da mensagem). |
| `TEST_JIRA` | Teste simples de conexão (legado / uso interno). |
| `JIRA_TEST_AND_LIST_BOARDS` | Teste + lista de quadros; campos opcionais **`jiraEmail`**, **`jiraApiToken`**, **`jiraSiteUrl`**, **`jiraSoftwareBoardId`** substituem temporariamente o storage (opções antes de Salvar). Sem ID de quadro, lista **todos** os quadros Agile acessíveis. |
| `QAF_TIMELINE_SESSION_START` | Inicia ou reata **sessão de timeline** para `sender.tab.id` (opcional `sessionId`); usado ao abrir/engajar o painel. |
| `QAF_TIMELINE_APPEND` | Envia lote de entradas **`InteractionTimelineEntryV1`** para acumular no store da aba (dedupe + cap + TTL no SW). |
| `QAF_TIMELINE_GET_FOR_SUBMIT` | Devolve a timeline consolidada da aba para fundir no contexto da issue no submit. |
| `QAF_TIMELINE_SESSION_END` | Limpa sessão da aba após envio ou fecho explícito do fluxo. |
| `QAF_LOAD_TAB_UI` / `QAF_PERSIST_TAB_UI` | Lê/grava estado efémero da UI de feedback por aba em **`chrome.storage.session`** (ex.: rascunho posição do painel). |
| `QAF_LOAD_PENDING_IMAGES` / `QAF_PERSIST_PENDING_IMAGES` | Lê/grava fila de capturas/imagens pendentes por **`tabId`** em sessão (sobrevive a reinícios do SW). |

---

## page-bridge e “erros” da extensão

`page-bridge.js` **roda** no **MAIN world** da página (script injetado) para:

- **Interceptar** **`console.error` / `warn` / `log`** e enviar um resumo via `CustomEvent` para o contexto da extensão (contexto técnico).
- **Interceptar** **`fetch`** e **registrar** respostas **não OK**.
- **Linha do tempo** (Phase 1): cliques, `submit`, `change` em campos, `input` com throttle (~2s por campo), teclas Enter/Tab/Escape, `popstate` e `history.pushState`/`replaceState` (SPA). Eventos dentro da UI da extensão (`#qa-feedback-extension-root`) são ignorados. Limites em `context-limits.ts`. O bridge só vê o **documento atual**; para manter histórico após **navegação completa na mesma aba**, o `context-collector` envia **deltas** ao SW (`QAF_TIMELINE_APPEND`) e o submit usa **`QAF_TIMELINE_GET_FOR_SUBMIT`** antes de aplicar limites de exibição — ver [Linha do tempo contínua](#linha-do-tempo-contínua-mesma-aba) e [PRD-010](../prd/PRD-010-linha-tempo-continua/prd.md).
- **Rede resumida** (Phase 2): cada **`fetch`** e **`XMLHttpRequest`** gera uma linha com método, URL (sanitizada na montagem do contexto), status, duração (ms), e cabeçalhos de correlação quando legíveis (`x-request-id`, `x-correlation-id`, etc.). Respostas **opacas** (CORS) podem vir com status `0` sem headers. A issue usa **`## Requisições relevantes`** (prioridade: erros, depois lentas ≥3s, depois outras; máx. 20 linhas). O HAR (CDP) continua opcional e separado.
- **Runtime e performance** (Phase 5): `window` **`error`** e **`unhandledrejection`** (mensagem, stack, ficheiro/linha quando existir, dedupe por chave); **`PerformanceObserver`** para LCP, layout-shift (CLS), `longtask` e INP (best-effort). O **`context-collector`** pode preencher **`deltaToLastClickMs`** no último erro face ao último clique da timeline. No corpo da issue: **`## Erro de runtime principal`** e **`## Sinais de performance`** quando há dados.
- **Estado visual e DOM alvo** (Phase 4): obtidos no **`context-collector`** no momento do envio (heurísticas no DOM: diálogos/modais, busy, abas ativas; dicas de seletor / `role` / texto para o alvo), não no bridge. Secções **`## Estado visual no momento do bug`** e **`## Elemento relacionado`** quando aplicável.

Quando um script do **site** (ex.: DataLive, analytics) chama `console.warn`, a stack pode incluir `page-bridge.js`; o Chrome pode mostrar isso na página **Errors** da extensão **sem** ser um bug do QAFeedback.

---

## Ícones (arte circular)

- Fonte: **`prd/assets/capiQA.png`**.
- **`npm run icons`** (incluso no `build`): recorta margens transparentes (**trim**), preenche o quadrado com **cover** e aplica máscara circular — o mascote ocupa melhor o espaço nos tamanhos pequenos da barra do Chrome (o tamanho do *slot* continua fixo pelo browser).
- Gera **`public/qa.png`** (64×64, FAB/modal) e **`public/icons/icon{16,32,48,128}.png`** (manifest + favicon da página de opções).

---

## Jira: quadro no modal, allowlist e tipo Bug → Task

1. **Lista de quadros** no painel usa **`listFilteredJiraBoardsForFeedback`** (via `LIST_REPO_TARGETS`): API Agile sem `projectKey` (todos os quadros), depois allowlist de build se existir — alinhado à página de opções com listagem global.
2. **`CREATE_ISSUE`:** o modal envia **`jiraSoftwareBoardId`** no payload quando o utilizador escolhe um quadro; **`pickJiraBoardIdForCreate`** exige que esse ID esteja na mesma lista permitida (**erro** se não estiver). Só usa o quadro «predefinido» das opções quando **não** há ID explícito no pedido.
3. **`resolveJiraBoardFieldsForIssueCreate`** lê o JQL do filtro do quadro (`type IN (...)` ou `issuetype = …`). Se o tipo nas opções for **Bug**, o filtro **não** incluir Bug mas **incluir Task**, o tipo efetivo passa a **Task** (`effectiveIssueTypeName` na resposta). O POST `/issue` usa esse nome.
4. Se o **POST /issue** falhar com erro típico de **issue type** e o tipo tentado for **Bug**, há **uma repetição** automática com **Task** (útil quando não houve resolução completa do filtro).

---

## Linha do tempo contínua (mesma aba)

Objetivo: o QA pode percorrer **várias URLs na mesma aba** (reloads / navegações completas) e, ao enviar o feedback, a issue inclui a **linha do tempo acumulada** dessa jornada — não só a página final.

- **`timeline-session-store.ts`** — merge incremental, deduplicação, limites e TTL; espelho em **`chrome.storage.session`** para sobreviver a reinícios do service worker (MV3).
- **`timeline-tab-session.ts`** — lógica no SW por **`tabId`** (handlers delegados a partir de `service-worker.ts`).
- **`timeline-append-queue.ts`** — fila de `QAF_TIMELINE_APPEND` para reduzir perda de eventos sob rajadas de snapshots.
- **`context-collector.ts`** — compara snapshots sucessivos do bridge e envia apenas entradas **novas** ao SW.
- **`FeedbackApp.tsx`** — `QAF_TIMELINE_SESSION_START` ao engajar o painel; `QAF_TIMELINE_SESSION_END` após sucesso ou fecho.

Especificação e análise de execução: [PRD-010 — pasta `prd/PRD-010-linha-tempo-continua/`](../prd/PRD-010-linha-tempo-continua/prd.md) (também [analise-execucao.md](../prd/PRD-010-linha-tempo-continua/analise-execucao.md)).

**Modos de captura, achados sensíveis e evolução OWASP-aware** documentam-se no [PRD-011](../prd/PRD-011-maturidade-produto/plan.md) (plano de maturidade do produto).

---

## Referência rápida de scripts

| Comando | Efeito |
|---------|--------|
| `npm run icons` | PNGs a partir de `prd/assets/capiQA.png` |
| `npm run build` | Ícones + Vite + page-bridge + `manifest.json` → `dist/` |
| `npm run check` | `tsc --noEmit` |
| `npm test` | Vitest — `src/**/*.test.ts` |
| `npm run test:watch` | Vitest em watch |
| `npm run dev` | Igual ao `build` (legado) |

Mais detalhes de primeiro uso: **[README.md](./README.md)**.
