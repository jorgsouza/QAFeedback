# QA Feedback — GitHub e Jira (Chrome MV3)

Extensão Chrome **Manifest V3**: envia feedback da **página em teste** para **GitHub Issues** e/ou **Jira Cloud** sem abrir outra **aba**. Tokens e chamadas às APIs ficam no **service worker**; a UI **roda** em **Shadow DOM** para não misturar CSS com o site.

**Documentação técnica completa:** [DOCUMENTATION.md](./DOCUMENTATION.md)

---

## O que a extensão faz

### Interface na página

- **Botão flutuante (FAB)** com ícone de QA nos domínios que você configurar nas opções; dá para **minimizar** o controle.
- Se o Chrome estiver em modo **“só ao clicar no ícone”**, use o **ícone da extensão** na barra para injetar o FAB nessa aba.
- **Painel** (sheet à direita) com abas **Formulário** e **Preview** (Markdown antes de enviar); **recolher** com a seta no cabeçalho mantém o rascunho — o **FAB** volta a abrir o painel.
- **Ícone de engrenagem** no cabeçalho abre a página de **opções** da extensão.
- **Faixa de estado** no topo do formulário: **bolinhas verdes** (GitHub e/ou Jira com token configurado); com **modo diagnóstico** ligado, **ícone ℹ️** com tooltip sobre captura HAR e DevTools. Erros de captura de rede continuam em banner visível.

### Destinos do envio

- **GitHub** (opcional): PAT com permissão de **Issues**; dá para listar **vários repositórios** e escolher um no menu ao enviar.
- **Jira Cloud** (opcional): e-mail Atlassian + **API token** + **quadro Software** (predefinido nas opções). No **modal**, quando aplicável, pode escolher **outro quadro** da lista (filtrada pela allowlist de build, se existir).
- **GitHub**, **Jira** ou **ambos** no mesmo envio, quando os dois estiverem configurados.

### Formulário

- **Título** (resumo) e **O que aconteceu** (descrição), obrigatórios conforme o destino.
- **Jira:** campo **Motivo da abertura do Bug/Sub-Bug** (valores fixos alinhados ao fluxo da sua equipe). O **tipo de issue** nas opções costuma ser **Bug**; se o **JQL do quadro** só permitir tipos como **Task**, a extensão usa **Task** na criação (e nas opções, ao testar o quadro, aparece aviso *Tipo na criação neste quadro: Task (nas opções: Bug)*). Se a API rejeitar o tipo Bug por outro motivo, há **uma nova tentativa** automática com **Task**.
- **Voz no Chrome:** microfone ao lado do título e da descrição — **pt-BR** por **padrão** (Web Speech API; requer HTTPS).
- **Ditado do sistema:** dicas na UI para usar o atalho do SO (ex.: Windows) nos mesmos campos.
- **Copiar markdown** do preview.

### Anexos e capturas (Jira)

- **Adicionar imagens** (arquivos, até o limite configurado).
- **Colar imagem** com **Ctrl+V** na área da descrição (com Jira selecionado).
- **Capturar área da página:** esconde o FAB/modal; você **arrasta** um **retângulo** no viewport visível e a extensão anexa um **PNG** recortado.

### Contexto técnico (opcional)

Com **Incluir contexto técnico** ativo, o relatório Markdown inclui, entre outros:

- **Resumo** e **leitura rápida da sessão** (narrativa derivada do contexto), antes do bloco técnico longo.
- URL, título da página, data/hora, **User-Agent**.
- **Viewport** (janela) e **tela** (`screen`), **DPR**, **maxTouchPoints**, **pointer fine/coarse**.
- **Indício automático** de vista desktop vs móvel vs **possível emulação no DevTools** (heurística — não há API oficial para o toggle de dispositivo).
- **Linha do tempo da interação** (cliques, navegação SPA, inputs relevantes — exceto UI da extensão), via **page-bridge**.
- **Requisições relevantes** (`fetch` e **XHR**): método, URL sanitizada, status, duração, IDs de correlação quando legíveis; prioridade erros e pedidos lentos.
- **Estado visual** (diálogos/modais, busy, abas ativas) e **elemento relacionado** (dicas de seletor / `role`), quando detetados.
- **Erro de runtime principal** e **sinais de performance** (LCP, CLS, long tasks, INP em browsers que suportam), quando houver dados.
- **Elemento em foco/clicado** na página (não o botão da extensão), com tag, id, classes e atributos sanitizados.
- **Console** (erros, avisos, logs). Pedidos só com falha continuam cobertos quando não há resumo completo de rede.
- No **Jira**, a descrição pode ser enviada em **ADF** convertido a partir do mesmo Markdown (`jira-markdown-adf.ts`). Detalhes: [DOCUMENTATION.md](./DOCUMENTATION.md).

### Modo diagnóstico completo (opções)

- Opção **Modo diagnóstico completo:** ao abrir o modal, a extensão pode **anexar um arquivo `.har`** ao criar a issue no **Jira** (captura de rede via **Chrome DevTools Protocol** com permissão `debugger`).
- Cabeçalhos sensíveis (ex.: **Cookie**, **Authorization**) aparecem como `[REDACTED]` no HAR; o texto da descrição inclui ajuda para importar no DevTools.
- Se a captura falhar com **DevTools** aberto na mesma aba, feche o DevTools e tente de novo.

### Depois do envio

- Links para abrir a **issue no GitHub** e/ou no **Jira** (quadro ou detalhe, conforme a configuração).
- **Copiar URLs**; **Novo feedback** ou **Fechar**.

---

## Requisitos

- Node 18+
- Chrome (Manifest V3)
- Conta **GitHub** e/ou **Jira Cloud**, conforme o que for configurar

## Tokens

### GitHub

- **PAT classic**: escopo adequado ao repo (ex.: `repo`) ou fine-grained com **Issues** read/write.
- O token fica em `chrome.storage.local`; a criação da issue roda no **background**.

### Jira Cloud

- **E-mail** Atlassian (o mesmo do Jira).
- **API token** ([Atlassian — API tokens](https://id.atlassian.com/manage-profile/security/api-tokens)).
- Com e-mail **@empresa**, o site `https://empresa.atlassian.net` em geral é **inferido** automaticamente (não funciona só com Gmail “pessoal” como identificador — use **Site** em Avançado se precisar).
- **Quadro**: depois de e-mail + token, a **lista de quadros** **carrega sozinha**; **ao escolher o quadro**, projeto/filtro são confirmados e **salvos** — não há botão “testar conexão” separado para isso.

## Build

```bash
cd extension
npm install
npm run build
```

O `build` **executa** **`npm run icons`** primeiro (`../prd/assets/capiQA.png` → `public/qa.png` + `public/icons/`).

Saída: **`dist/`**. Carregue **`extension/dist`** em **chrome://extensions** (modo desenvolvedor).

**Allowlist de quadros Jira (opcional, só build):** em `extension/.env` ou na **raiz do repo** use `BOARD_ID=455,451,...` **ou** `VITE_JIRA_BOARD_ALLOWLIST=…` antes de `npm run build` (o Vite lê ambos). Lista vazia = sem filtro. Reconstrua e recarregue a extensão após mudar o `.env`. Não inclua **API tokens** no `.env` empacotado.

## Erro “Extension context invalidated”

Acontece se você **recarregar a extensão** sem dar **F5** na **aba** do site. Veja [DOCUMENTATION.md](./DOCUMENTATION.md#extension-context-invalidated).

## Primeiro uso

1. Abra as **Opções** da extensão.
2. **GitHub** (opcional): token → **Testar conexão e listar repos** → ajuste a lista → **Salvar**.
3. **Jira** (opcional): e-mail + API token → espere o menu **Quadro Software** → escolha o quadro → **Salvar**.
4. **Domínios permitidos**: um por linha; ao **Salvar** o Chrome pode pedir permissão para sites novos.
5. Abra um site permitido; use o **FAB** (ou o ícone da extensão se estiver “ao clicar”).

### Botão não aparece?

1. Ícone da extensão → **“Esta extensão pode ler e alterar dados do site”** — não deixe só “ao clicar” sem clicar no ícone na aba, ou escolha o site / todos os sites.
2. Domínio correto nas opções + permissão aceita ao **Salvar**.
3. Não use `chrome://`, Web Store, etc., para o feedback embutido.

Mais detalhes: [DOCUMENTATION.md](./DOCUMENTATION.md#botão-não-aparece).

## Permissões (resumo)

| Permissão | Uso |
|-----------|-----|
| `storage` | Guardar opções e tokens localmente |
| `scripting` | Registrar/injetar o content script nos hosts permitidos |
| `activeTab` | Injeção ao clicar no ícone; captura do viewport para “Capturar área” |
| `debugger` | Só quando **Modo diagnóstico completo** está ligado (captura HAR) |
| Hosts fixos | `api.github.com`, `*.atlassian.net`, localhost / 127.0.0.1 |
| Hosts opcionais | Os que você adicionar nas opções (pedido ao **Salvar**) |

---

## Estrutura (principais arquivos)

| Área | Caminho |
|------|---------|
| Content + UI | `src/content/`, `src/ui/` |
| Opções | `src/options/` |
| Service worker | `src/background/service-worker.ts` |
| GitHub | `src/shared/github-client.ts` |
| Jira | `src/shared/jira-client.ts`, `jira-board-filter-resolve.ts`, `jira-board-allowlist.ts`, `jira-boards-list-for-feedback.ts` |
| Issue / contexto | `src/shared/issue-builder.ts`, `context-collector.ts`, `context-limits.ts` |
| Narrativa / Jira ADF | `src/shared/issue-narrative.ts`, `src/shared/jira-markdown-adf.ts` |
| Timeline / rede (helpers) | `src/shared/interaction-timeline.ts`, `src/shared/network-summary.ts` |
| Indício vista desktop/móvel | `src/shared/view-layout-hint.ts` |
| page-bridge (MAIN world) | `src/injected/page-bridge.ts` |
| Voz | `src/shared/chrome-speech-dictation.ts`, `src/ui/useChromeSpeechDictation.ts` |
| Storage | `src/shared/storage.ts` |
| HAR / captura rede | `src/shared/network-har.ts`, `src/background/network-debugger-capture.ts` |
| Captura por região | `src/shared/region-screenshot-crop.ts`, `src/content/region-picker-overlay.ts`, `region-screenshot-flow.ts` |

## Scripts

- `npm run icons` — ícones a partir de `prd/assets/capiQA.png` (`trim` + preenchimento do círculo para o mascote ocupar melhor o slot da barra do Chrome)
- `npm run build` — produção → `dist/`
- `npm run dev` — igual ao `build`
- `npm run check` — TypeScript
- `npm test` / `npm run test:watch` — Vitest

Alterou o código? Rode `npm run build` e **recarregue** a extensão em `chrome://extensions`.
