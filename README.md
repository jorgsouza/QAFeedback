# QAFeedback

Extensão para **Google Chrome** (Manifest V3) que ajuda equipes de **QA**, desenvolvimento e produto a **abrir issues no GitHub** e/ou no **Jira Cloud** **sem sair da página** em que estão testando. O objetivo é **menos cliques** entre “encontrei um problema aqui” e “ficou **registrado** no sistema”.

---

## Estrutura do repositório

| Local | Conteúdo |
|--------|----------|
| [`extension/`](extension/) | Código da extensão (React + TypeScript, Vite, Vitest). Saída de build: **`extension/dist/`** (carregar em `chrome://extensions`). |
| [`prd/`](prd/) | **PRDs e planos numerados** (PRD-001 … PRD-011). Índice e estado de cada um: [`prd/INDEX.md`](prd/INDEX.md). Arte compartilhada: [`prd/assets/capiQA.png`](prd/assets/capiQA.png) (ícone / script de build). |
| [`plans/`](plans/) | Atalho — histórico consolidado em `prd/`; ver [`plans/README.md`](plans/README.md). |
| [`.cursor/skills/`](.cursor/skills/) | *Agent Skills* do Cursor para este projeto (TDD, PRD→plano, testes, etc.): [`.cursor/skills/README.md`](.cursor/skills/README.md). |
| [`.env.example`](.env.example) (raiz) | Variáveis opcionais para **ferramentas do time** (ex.: `FIGMA_API_KEY` — não faz parte do bundle da extensão). |
| [`extension/.env.example`](extension/.env.example) | Variáveis de **build** da extensão (ex.: allowlist de quadros Jira). **Não** colocar tokens de API aqui. |

Este repositório é **só a extensão e documentação**; não inclui servidor próprio — GitHub e Jira são as APIs de destino.

---

## O que a extensão faz (resumo)

### Na página em teste

- **FAB** (botão flutuante) nos **domínios** que você configurar (staging, `localhost`, etc.).
- **Painel** à direita: **Formulário** e **Preview** em Markdown; **recolher** mantém o rascunho; **minimizar** o FAB quando precisar de mais espaço.
- Se o Chrome estiver em **“só ao clicar”**, usa o **ícone da extensão** nessa aba para aparecer o feedback embutido.

### Destinos e envio

- **Só GitHub**, **só Jira** ou **ambos** — conforme tokens nas opções.
- **GitHub:** escolha de **repositório** se tiver vários na lista.
- **Jira:** **motivo de abertura** (Bug/Sub-Bug), **quadro Software** no modal quando há allowlist no build; se o **JQL do quadro** não aceitar **Bug** mas aceitar **Task**, a extensão cria como **Task** automaticamente.

### Contexto no relatório (opcional)

- URL, viewport, **tela e DPR**, indício **desktop / móvel / emulação DevTools**.
- **Linha do tempo** de interação: inclui fluxo **contínuo na mesma aba** ao mudar de URL várias vezes (sessão por `tabId` no service worker + append incremental) — ver [PRD-010](prd/PRD-010-linha-tempo-continua/prd.md).
- **Requisições relevantes** (fetch/XHR), **estado visual** / DOM alvo, **erros de runtime**, **performance** (best-effort), **narrativa** (resumo), elemento clicado, **console**.
- **Modos de captura** e **achados sensíveis** (heurísticas OWASP-aware, sem afirmar causalidade) — roadmap em [PRD-011](prd/PRD-011-maturidade-produto/plan.md).

### Anexos e diagnóstico (Jira)

- **Imagens:** arquivos, **Ctrl+V** na descrição, ou **captura por região** no viewport.
- **Modo diagnóstico completo** (opções): anexo **`.har`** com tráfego da aba (CDP), cabeçalhos sensíveis redigidos.

### Depois de enviar

- **Links** para GitHub e/ou Jira; **copiar URLs**.

Detalhe funcional, tokens e primeiro uso: **[extension/README.md](extension/README.md)**. Guia técnico (arquitetura, mensagens do SW, page-bridge): **[extension/DOCUMENTATION.md](extension/DOCUMENTATION.md)**.

---

## Como usar (resumo)

1. Configurar uma vez: tokens, domínios, repos GitHub e/ou quadro Jira — [extension/README.md](extension/README.md).
2. Abrir site permitido (aceitar permissões se o Chrome pedir).
3. **FAB** (ou ícone da extensão) → preencher → **Preview** opcional → **Enviar**.

**Voz:** microfone nos campos (Chrome, **pt-BR** por padrão, com HTTPS) ou ditado do sistema — a extensão não grava áudio por conta própria.

---

## Desenvolvimento

**Requisitos:** Node.js **18+**, Google Chrome.

```bash
cd extension
npm install
npm run build    # ícones (prd/assets) + Vite + page-bridge + manifest → dist/
npm run check    # TypeScript (tsc --noEmit)
npm test         # Vitest (unitários)
# npm run test:watch   # durante desenvolvimento
```

Carregar **`extension/dist`** em **chrome://extensions** (modo desenvolvedor). Após alterações: `npm run build` e **Recarregar** a extensão.

**Allowlist de quadros Jira (opcional, só build):** `extension/.env` ou `.env` na raiz do repo — `BOARD_ID=…` ou `VITE_JIRA_BOARD_ALLOWLIST=…` (ver [extension/README.md](extension/README.md)). **Nunca** faça commit de tokens.

---

## Documentação e PRDs

| Recurso | Descrição |
|---------|-----------|
| [extension/README.md](extension/README.md) | Funcionalidades completas, tokens, build, permissões, estrutura principal dos arquivos do código |
| [extension/DOCUMENTATION.md](extension/DOCUMENTATION.md) | Guia técnico: opções, SW, page-bridge, mensagens (`QAF_TIMELINE_*`, sessão por aba), resolução de problemas, Jira/ADF |
| [prd/INDEX.md](prd/INDEX.md) | **Índice de PRD-001 … PRD-011** (estado, links para `prd.md` / `plan.md` / `execution-plan.md`) |
| [prd/PRD-010-linha-tempo-continua/](prd/PRD-010-linha-tempo-continua/) | Linha do tempo contínua (mesma aba, multi-URL) — especificação + análise de execução |
| [prd/PRD-011-maturidade-produto/](prd/PRD-011-maturidade-produto/) | Maturidade do produto (debug interno, segurança pragmática) — plano + plano de execução por fases |
| [plans/README.md](plans/README.md) | Redirecionamento para `prd/` |
| [`.cursor/skills/README.md`](.cursor/skills/README.md) | Skills de agente (TDD, PRD→plano, mocks, refactor, etc.) |

---

## Quem se beneficia

- Equipes que já usam **GitHub Issues** e/ou **Jira Cloud**.
- QAs que querem **texto mais padronizado** e menos copiar/colar entre o navegador e o backoffice.
- Quem gere **vários repositórios** ou **quadros** e escolhe o destino no momento do envio.
