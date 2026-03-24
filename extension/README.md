# QA Feedback — GitHub e Jira (Chrome MV3)

Extensão: **FAB** em páginas permitidas, modal (**Formulário** / **Preview**), envio para **GitHub** e/ou **Jira Cloud**, token(s) só no **service worker**, contexto técnico opcional, **prints no Jira**, **voz no Chrome** (Web Speech API, **pt-BR** por **padrão**), UI em **Shadow DOM**.

**Documentação completa:** [DOCUMENTATION.md](./DOCUMENTATION.md)

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
- **Quadro**: depois de e-mail + token, a **lista de quadros** **carrega sozinha**; **ao escolher o quadro**, projeto/filtro são confirmados e **salvos** — não há botão “testar conexão”.

## Build

```bash
cd extension
npm install
npm run build
```

O `build` **executa** **`npm run icons`** primeiro (`../PRD/capiQA.png` → `public/qa.png` + `public/icons/`).

Saída: **`dist/`**. Carregue **`extension/dist`** em **chrome://extensions** (modo desenvolvedor).

## Erro “Extension context invalidated”

Acontece se você recarregar a extensão sem dar **F5** na **aba** do site. Veja [DOCUMENTATION.md](./DOCUMENTATION.md#extension-context-invalidated).

## Primeiro uso

1. Abra as **Opções** da extensão.
2. **GitHub** (opcional): token → **Testar conexão e listar repos** → ajuste a lista → **Salvar**.
3. **Jira** (opcional): e-mail + API token → espere o menu **Quadro Software** **carregar** → escolha o quadro → **Salvar** (também para hosts / repos do GitHub).
4. **Domínios permitidos**: um por linha; ao Salvar o Chrome pode pedir permissão para sites novos.
5. Abra um site permitido; use o **FAB** (ou o ícone da extensão se estiver “ao clicar”).

### Botão não aparece?

1. Ícone da extensão → **“Esta extensão pode ler e alterar dados do site”** — não deixe só “ao clicar” sem clicar no ícone na aba, ou escolha o site / todos os sites.
2. Domínio correto nas opções + permissão aceita ao Salvar.
3. Não use `chrome://`, Web Store etc. para o feedback embutido.

Detalhes: [DOCUMENTATION.md](./DOCUMENTATION.md#botão-não-aparece).

## Permissões

- `storage`, `scripting`, `activeTab`, **`debugger`** (só necessário para o modo diagnóstico de rede / HAR)
- Fixas: `https://api.github.com/*`, **`https://*.atlassian.net/*`**, localhost / 127.0.0.1
- `optional_host_permissions` para os hosts que você adicionar nas opções (ao Salvar)

### Modo diagnóstico completo (HAR no Jira)

Nas **opções**, pode ativar **Modo diagnóstico completo**. Com isso, ao abrir o modal de feedback a extensão tenta **registar o tráfego HTTP** da aba (Chrome DevTools Protocol) e, ao **criar a issue no Jira**, anexa um ficheiro **`.har`** (se houver pedidos capturados) e acrescenta à descrição um texto com instruções de importação no DevTools.

- Se **outro depurador** já estiver ligado à mesma aba (por exemplo **DevTools**), a captura pode falhar: **feche o DevTools nessa aba** e reabra o feedback.
- Cabeçalhos como **Cookie** e **Authorization** são substituídos por `[REDACTED]` no HAR; corpos mantêm-se como capturados.

### Captura por região (prints Jira)

No modal, com **Jira** como destino, **«Capturar área da página»** esconde o FAB/modal, permite **arrastar um retângulo** na área **visível** do separador e anexa o recorte em PNG (`captureVisibleTab` no service worker).

## Estrutura (principais arquivos)

| Área | Caminho |
|------|---------|
| Content + UI | `src/content/`, `src/ui/` |
| Opções | `src/options/` |
| Service worker | `src/background/service-worker.ts` |
| GitHub | `src/shared/github-client.ts` |
| Jira | `src/shared/jira-client.ts`, `jira-board-filter-resolve.ts` |
| Issue / contexto | `src/shared/issue-builder.ts`, `context-collector.ts` |
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

Alterou o código? Rode `npm run build` e **Recarregue** a extensão.
