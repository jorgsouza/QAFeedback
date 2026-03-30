# Índice de PRDs e planos (QAFeedback)

**Idioma:** português do Brasil (pt-BR).

Documentação de produto e planos de implementação vivem em **`prd/`**, numerados por ordem de arquivo (**PRD-001** … **PRD-011**). Cada pasta pode ter `prd.md` (especificação), `plan.md` (plano técnico / fases) ou vários arquivos (ex.: spec + anexos).

| ID | Título | Conteúdo | Estado (alto nível) |
|----|--------|----------|---------------------|
| **PRD-001** | Chrome Extension — feedback QA → GitHub | [prd.md](PRD-001-chrome-extension-qa-feedback/prd.md) | Especificação fundacional do produto |
| **PRD-002** | Contexto rico — spec (`features`) + rotas | [features.md](PRD-002-features-context-spec/features.md), [routes.go](PRD-002-features-context-spec/routes.go) | Referência viva de requisitos; `routes.go` só documentação para mapear rotas SPA |
| **PRD-003** | Contexto rico na issue — plano por fases | [plan.md](PRD-003-context-rich-issues/plan.md) | Phases 0–5 na `main` (merge [PR #6](https://github.com/jorgsouza/QAFeedback/pull/6)); Phase 6 opcional |
| **PRD-004** | Rota SPA + chip na UI + contexto técnico | [plan.md](PRD-004-spa-page-route-context/plan.md) | Implementado na `main` (ver seção 8 do plano) |
| **PRD-005** | Painel canto + board Jira no modal + allowlist | [plan.md](PRD-005-jira-board-panel-filter/plan.md) | Implementado na `main` (ver seção 6 do plano) |
| **PRD-006** | Modo diagnóstico HAR + anexo Jira | [plan.md](PRD-006-network-har-diagnostic/plan.md) | Implementado (CDP + anexo; ver código e `DOCUMENTATION.md`) |
| **PRD-007** | Layout Figma / Trust DS / título 4 palavras | [plan.md](PRD-007-figma-layout-qa-automation-trust-ds/plan.md) | UI em evolução; validar critérios de aceite no doc |
| **PRD-008** | Captura por região (viewport) → Jira | [plan.md](PRD-008-region-capture-jira/plan.md) | Implementado no código; atualizar checkboxes do plano se QA validar |
| **PRD-009** | UX da página de opções / configuração | [prd.md](PRD-009-options-config-ux/prd.md), [plan.md](PRD-009-options-config-ux/plan.md) | Em curso — trabalho na branch remota `feature/options-config-ux-refactor`; PRD + plano (Fases 1–3) |
| **PRD-010** | Linha do tempo contínua na mesma aba (multi-URL) | [prd.md](PRD-010-linha-tempo-continua/prd.md), [analise-execucao.md](PRD-010-linha-tempo-continua/analise-execucao.md) | Implementado na `main` (sessão por `tabId` no SW + append incremental) |
| **PRD-011** | Maturidade do produto — debug interno, segurança pragmática (OWASP-aware) | [plan.md](PRD-011-maturidade-produto/plan.md), [execution-plan.md](PRD-011-maturidade-produto/execution-plan.md) (fases verticais) | Plano ativo; Etapas 1–7 (preview consistente fora de escopo) após PRD-009; [OWASP](https://owasp.org/) |
| **PRD-012** | Gravação contínua de viewport (WebM) para evidências QA | [plan.md](PRD-012-gravacao-viewport/plan.md) | Planejado — plano técnico inicial com arquitetura MV3 (offscreen + tabCapture + MediaRecorder) |

## Linguagem ubíqua (vocabulário do domínio)

Termos compartilhados entre produto, QA e código — [LINGUAGEM-UBIQUA.md](LINGUAGEM-UBIQUA.md).

## Recursos compartilhados

- **Diagrama de arquitetura (PNG):** [assets/mermaid.png](assets/mermaid.png) — export do diagrama; documentação em [`architecture_overview.md`](../architecture_overview.md) na raiz do repositório.
- **Ícone / mascote:** [assets/capiQA.png](assets/capiQA.png) — usado pelo script `extension/scripts/roundify-capiqa.mjs` no build.

## Migração das pastas antigas

- Conteúdo que estava na pasta **`PRD/`** (histórico) e em **`plans/`** foi movido para **`prd/PRD-00x-…/`**. A pasta **`PRD/`** deixou de existir no repositório.
- Atalho restante: [plans/README.md](../plans/README.md).
