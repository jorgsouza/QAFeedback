# QA Feedback — GitHub e Jira (Chrome MV3)

Extensão Chrome **Manifest V3**: envia feedback da **página em teste** para **GitHub Issues** e/ou **Jira Cloud** sem abrir outro separador. Tokens e chamadas às APIs ficam no **service worker**; a UI corre em **Shadow DOM** para não misturar CSS com o site.

**Documentação técnica completa:** [DOCUMENTATION.md](./DOCUMENTATION.md)

---

## O que a extensão faz

### Interface na página

- **Botão flutuante (FAB)** com ícone de QA nos domínios que configurares; podes **minimizar** o controlo.
- Se o Chrome estiver em modo **“só ao clicar no ícone”**, usa o **ícone da extensão** na barra para injetar o FAB nessa aba.
- **Modal** com separadores **Formulário** e **Preview** (Markdown antes de enviar).
- Ligação **Configurações** para abrir a página de opções da extensão.

### Destinos do envio

- **GitHub** (opcional): PAT com permissão de **Issues**; podes listar **vários repositórios** e escolher um no menu ao enviar.
- **Jira Cloud** (opcional): e-mail Atlassian + **API token** + **quadro Software** (backlog destino).
- **GitHub**, **Jira** ou **ambos** no mesmo envio, quando tiveres os dois configurados.

### Formulário

- **Título** (resumo) e **O que aconteceu** (descrição), obrigatórios conforme o destino.
- **Jira:** campo **Motivo da abertura do Bug/Sub-Bug** (valores fixos alinhados ao vosso fluxo).
- **Voz no Chrome:** microfone ao lado do título e da descrição — **pt-BR** por defeito (Web Speech API; requer HTTPS).
- **Ditado do sistema:** dicas no UI para usar o atalho do SO (ex.: Windows) nos mesmos campos.
- **Copiar markdown** do preview.

### Anexos e capturas (Jira)

- **Adicionar imagens** (ficheiros, até ao limite configurado).
- **Colar imagem** com **Ctrl+V** na área da descrição (com Jira selecionado).
- **Capturar área da página:** esconde o FAB/modal, desenhas um **retângulo** no viewport visível e a extensão anexa um **PNG** recortado.

### Contexto técnico (opcional)

Com **Incluir contexto técnico** ativo, o relatório Markdown inclui, entre outros:

- URL, título da página, data/hora, **User-Agent**.
- **Viewport** (janela) e **ecrã** (`screen`), **DPR**, **maxTouchPoints**, **pointer fine/coarse**.
- **Indício automático** de vista desktop vs móvel vs **possível emulação no DevTools** (heurística — não há API oficial para o toggle de dispositivo).
- **Elemento em foco/clicado** na página (não o botão da extensão), com tag, id, classes e atributos sanitizados.
- **Console** (erros, avisos, logs) e **pedidos `fetch` falhados** recolhidos via **page-bridge** injetado na página.

### Modo diagnóstico completo (opções)

- Opção **Modo diagnóstico completo:** ao abrir o modal, a extensão pode **anexar um ficheiro `.har`** ao criar a issue no **Jira** (captura de rede via **Chrome DevTools Protocol** com permissão `debugger`).
- Cabeçalhos sensíveis (ex.: **Cookie**, **Authorization**) aparecem como `[REDACTED]` no HAR; o texto da descrição inclui ajuda para importar no DevTools.
- Se a captura falhar com **DevTools** aberto na mesma aba, fecha o DevTools e tenta de novo.

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
- Com e-mail **@empresa**, o site `https://empresa.atlassian.net` em geral é **inferido** automaticamente (não funciona só com Gmail “pessoal” como identificador — usa **Site** em Avançado se precisar).
- **Quadro**: depois de e-mail + token, a **lista de quadros** **carrega sozinha**; **ao escolher o quadro**, projeto/filtro são confirmados e **salvos** — não há botão “testar conexão” separado para isso.

## Build

```bash
cd extension
npm install
npm run build
```

O `build` **executa** **`npm run icons`** primeiro (`../PRD/capiQA.png` → `public/qa.png` + `public/icons/`).

Saída: **`dist/`**. Carrega **`extension/dist`** em **chrome://extensions** (modo desenvolvedor).

## Erro “Extension context invalidated”

Acontece se recarregares a extensão sem dar **F5** na **aba** do site. Vê [DOCUMENTATION.md](./DOCUMENTATION.md#extension-context-invalidated).

## Primeiro uso

1. Abre as **Opções** da extensão.
2. **GitHub** (opcional): token → **Testar conexão e listar repos** → ajusta a lista → **Salvar**.
3. **Jira** (opcional): e-mail + API token → espera o menu **Quadro Software** → escolhe o quadro → **Salvar**.
4. **Domínios permitidos**: um por linha; ao **Salvar** o Chrome pode pedir permissão para sites novos.
5. Abre um site permitido; usa o **FAB** (ou o ícone da extensão se estiver “ao clicar”).

### Botão não aparece?

1. Ícone da extensão → **“Esta extensão pode ler e alterar dados do site”** — não deixes só “ao clicar” sem clicar no ícone na aba, ou escolhe o site / todos os sites.
2. Domínio correto nas opções + permissão aceita ao **Salvar**.
3. Não uses `chrome://`, Web Store, etc., para o feedback embutido.

Mais detalhes: [DOCUMENTATION.md](./DOCUMENTATION.md#botão-não-aparece).

## Permissões (resumo)

| Permissão | Uso |
|-----------|-----|
| `storage` | Guardar opções e tokens localmente |
| `scripting` | Registar/injetar o content script nos hosts permitidos |
| `activeTab` | Injeção ao clicar no ícone; captura do viewport para “Capturar área” |
| `debugger` | Só quando **Modo diagnóstico completo** está ligado (captura HAR) |
| Hosts fixos | `api.github.com`, `*.atlassian.net`, localhost / 127.0.0.1 |
| Hosts opcionais | Os que adicionares nas opções (pedido ao **Salvar**) |

---

## Estrutura (principais ficheiros)

| Área | Caminho |
|------|---------|
| Content + UI | `src/content/`, `src/ui/` |
| Opções | `src/options/` |
| Service worker | `src/background/service-worker.ts` |
| GitHub | `src/shared/github-client.ts` |
| Jira | `src/shared/jira-client.ts`, `jira-board-filter-resolve.ts` |
| Issue / contexto | `src/shared/issue-builder.ts`, `context-collector.ts` |
| Indício vista desktop/móvel | `src/shared/view-layout-hint.ts` |
| page-bridge (MAIN world) | `src/injected/page-bridge.ts` |
| Voz | `src/shared/chrome-speech-dictation.ts`, `src/ui/useChromeSpeechDictation.ts` |
| Storage | `src/shared/storage.ts` |
| HAR / captura rede | `src/shared/network-har.ts`, `src/background/network-debugger-capture.ts` |
| Captura por região | `src/shared/region-screenshot-crop.ts`, `src/content/region-picker-overlay.ts`, `region-screenshot-flow.ts` |

## Scripts

- `npm run icons` — ícones a partir do PRD
- `npm run build` — produção → `dist/`
- `npm run dev` — igual ao `build`
- `npm run check` — TypeScript
- `npm test` / `npm run test:watch` — Vitest

Alteraste o código? Corre `npm run build` e **Recarrega** a extensão em `chrome://extensions`.
