# QA Feedback — GitHub e Jira (Chrome MV3)

Extensão: **FAB** em páginas permitidas, modal (**Formulário** / **Preview**), envio para **GitHub** e/ou **Jira Cloud**, token(s) só no **service worker**, contexto técnico opcional, **prints no Jira**, **voz no Chrome** (Web Speech API, `pt-BR` por defeito), UI em **Shadow DOM**.

**Documentação completa:** [DOCUMENTATION.md](./DOCUMENTATION.md)

## Requisitos

- Node 18+
- Chrome (Manifest V3)
- Conta **GitHub** e/ou **Jira Cloud** conforme o que for configurar

## Tokens

### GitHub

- **PAT classic**: escopo adequado ao repo (ex. `repo`) ou fine-grained com **Issues** read/write.
- O token fica em `chrome.storage.local`; a criação da issue é no **background**.

### Jira Cloud

- **Email** Atlassian (o mesmo do Jira).
- **API token** ([Atlassian — API tokens](https://id.atlassian.com/manage-profile/security/api-tokens)).
- Com email **@empresa**, o site `https://empresa.atlassian.net` costuma **inferir-se** automaticamente (não serve para Gmail “pessoal” como único identificador — use **Site** em Avançado se precisar).
- **Quadro**: após email + token, a **lista de quadros** enche sozinha; **escolher o quadro** confirma projeto/filtro e **grava** — não há botão “testar ligação”.

## Build

```bash
cd extension
npm install
npm run build
```

O `build` corre **`npm run icons`** primeiro (`../PRD/capiQA.png` → `public/qa.png` + `public/icons/`).

Saída: **`dist/`**. Carregar **`extension/dist`** em **chrome://extensions** (modo desenvolvedor).

## Erro “Extension context invalidated”

Recarregar a extensão sem **F5** no separador do site. Ver [DOCUMENTATION.md](./DOCUMENTATION.md#extension-context-invalidated).

## Primeiro uso

1. **Opções** da extensão.
2. **GitHub** (opcional): token → **Testar conexão e listar repos** → ajustar lista → **Salvar**.
3. **Jira** (opcional): email + API token → aguardar o menu **Quadro Software** encher → escolher quadro → **Salvar** (também para hosts / repos GitHub).
4. **Domínios permitidos**: um por linha; ao Salvar o Chrome pode pedir permissão para sites novos.
5. Abrir um site permitido; usar o **FAB** (ou ícone da extensão se estiver “ao clicar”).

### Botão não aparece?

1. Ícone da extensão → **“Esta extensão pode ler e alterar dados do site”** — não deixe só “ao clicar” sem clicar no ícone na aba, ou escolha o site / todos os sites.
2. Domínio correto nas opções + permissão aceite ao Salvar.
3. Não usar `chrome://`, Web Store, etc. para o feedback embutido.

Detalhes: [DOCUMENTATION.md](./DOCUMENTATION.md#botão-não-aparece).

## Permissões

- `storage`, `scripting`, `activeTab`
- Fixas: `https://api.github.com/*`, **`https://*.atlassian.net/*`**, localhost / 127.0.0.1
- `optional_host_permissions` para os hosts que adicionar nas opções (ao Salvar)

## Estrutura (ficheiros principais)

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

## Scripts

- `npm run icons` — ícones a partir do PRD
- `npm run build` — produção → `dist/`
- `npm run dev` — igual ao `build`
- `npm run check` — TypeScript
- `npm test` / `npm run test:watch` — Vitest

Alterou código → `npm run build` → **Recarregar** a extensão.
