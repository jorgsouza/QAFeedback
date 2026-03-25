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
12. [Referência rápida de scripts](#referência-rápida-de-scripts)

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

O `build` **executa** **`npm run icons`** (lê **`../PRD/capiQA.png`**, máscara circular → `public/qa.png` e `public/icons/icon*.png`).

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
4. **Faixa de estado** (topo do formulário): **bolinhas verdes** = token GitHub e/ou Jira configurado (tooltip com texto acessível). Com **modo diagnóstico completo** nas opções, aparece **ícone ℹ️** com o texto longo sobre HAR e DevTools; falhas de captura de rede seguem em **banner** separado.
5. **Jira**: **Board do Jira para vincular** (obrigatório quando Jira está ativo) — lista igual à das opções, respeitando a allowlist de build se existir; preencher **Motivo da abertura**; **prints** (botão ou Ctrl+V na descrição, com limites).
6. **Título** / **O que aconteceu**; **microfone** para voz no Chrome (veja a seção seguinte).
7. **Preview** → **Enviar** (o payload pode incluir o **ID do quadro** escolhido no passo 5).

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
| Contexto / injeção | `src/shared/context-collector.ts`, `src/injected/page-bridge.ts` |
| Ditado SO (textos) | `src/shared/native-dictation-hint.ts` |
| Storage / tipos | `src/shared/storage.ts`, `types.ts` |
| Runtime da extensão | `src/shared/extension-runtime.ts` |
| HAR / captura CDP | `src/shared/network-har.ts`, `network-har-jira-help.ts`, `src/background/network-debugger-capture.ts` |
| Captura por região | `src/shared/region-screenshot-crop.ts`, `src/content/region-picker-overlay.ts`, `region-screenshot-flow.ts` |

---

## Mensagens do service worker

`chrome.runtime.sendMessage` / listener no `service-worker.ts`:

| Tipo | Uso |
|------|-----|
| `LIST_REPO_TARGETS` | UI do feedback: repos, flags token GitHub/Jira, **`fullNetworkDiagnostic`**, e com Jira ligado **`jiraBoards`** / **`jiraDefaultBoardId`** filtrados pela allowlist de build, ou **`jiraBoardsError`**. |
| `OPEN_OPTIONS` | Abre a página de opções. |
| `CREATE_ISSUE` | Cria issue GitHub e/ou Jira conforme o payload (com `sender.tab` para consumir HAR no Jira). Opcional **`jiraSoftwareBoardId`**: quadro usado só nesse envio (validado face à lista filtrada). |
| `START_NETWORK_DIAGNOSTIC` | Com opção ativa: anexa CDP à aba do remetente e inicia `Network.enable`. |
| `STOP_NETWORK_DIAGNOSTIC` | Desliga o depurador na aba do remetente (cancelar/fechar modal). |
| `CAPTURE_VISIBLE_TAB` | Devolve `dataUrl` PNG do viewport (`chrome.tabs.captureVisibleTab(windowId, …)` — usa `sender.tab.windowId`, não `tabId`). |
| `TEST_GITHUB` | Valida PAT e lista repos (as opções podem mandar o token no corpo da mensagem). |
| `TEST_JIRA` | Teste simples de conexão (legado / uso interno). |
| `JIRA_TEST_AND_LIST_BOARDS` | Teste + lista de quadros; campos opcionais **`jiraEmail`**, **`jiraApiToken`**, **`jiraSiteUrl`**, **`jiraSoftwareBoardId`** substituem temporariamente o storage (opções antes de Salvar). Sem ID de quadro, lista **todos** os quadros Agile acessíveis. |

---

## page-bridge e “erros” da extensão

`page-bridge.js` **roda** no **MAIN world** da página (script injetado) para:

- **Interceptar** **`console.error` / `warn` / `log`** e enviar um resumo via `CustomEvent` para o contexto da extensão (contexto técnico).
- **Interceptar** **`fetch`** e **registrar** respostas **não OK**.

Quando um script do **site** (ex.: DataLive, analytics) chama `console.warn`, a stack pode incluir `page-bridge.js`; o Chrome pode mostrar isso na página **Errors** da extensão **sem** ser um bug do QAFeedback.

---

## Ícones (arte circular)

- Fonte: **`PRD/capiQA.png`**.
- **`npm run icons`** (incluso no `build`): recorta margens transparentes (**trim**), preenche o quadrado com **cover** e aplica máscara circular — o mascote ocupa melhor o espaço nos tamanhos pequenos da barra do Chrome (o tamanho do *slot* continua fixo pelo browser).
- Gera **`public/qa.png`** (64×64, FAB/modal) e **`public/icons/icon{16,32,48,128}.png`** (manifest + favicon da página de opções).

---

## Jira: quadro no modal, allowlist e tipo Bug → Task

1. **Lista de quadros** no painel vem do mesmo fluxo que nas opções (`JIRA_TEST_AND_LIST_BOARDS` / `LIST_REPO_TARGETS`), filtrada por **`builtInJiraBoardAllowlistIds()`** quando o build define allowlist.
2. **`CREATE_ISSUE`:** o content envia **`jiraSoftwareBoardId`** opcional; o service worker valida contra a lista conhecida e repassa a `createJiraIssue`.
3. **`resolveJiraBoardFieldsForIssueCreate`** lê o JQL do filtro do quadro (`type IN (...)` ou `issuetype = …`). Se o tipo nas opções for **Bug**, o filtro **não** incluir Bug mas **incluir Task**, o tipo efetivo passa a **Task** (`effectiveIssueTypeName` na resposta). O POST `/issue` usa esse nome.
4. Se o **POST /issue** falhar com erro típico de **issue type** e o tipo tentado for **Bug**, há **uma repetição** automática com **Task** (útil quando não houve resolução completa do filtro).

---

## Referência rápida de scripts

| Comando | Efeito |
|---------|--------|
| `npm run icons` | PNGs a partir de `PRD/capiQA.png` |
| `npm run build` | Ícones + Vite + page-bridge + `manifest.json` → `dist/` |
| `npm run check` | `tsc --noEmit` |
| `npm test` | Vitest — `src/**/*.test.ts` |
| `npm run test:watch` | Vitest em watch |
| `npm run dev` | Igual ao `build` (legado) |

Mais detalhes de primeiro uso: **[README.md](./README.md)**.
