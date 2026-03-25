# Índice de PRDs e planos (QAFeedback)

Documentação de produto e planos de implementação vivem em **`prd/`**, numerados por ordem de arquivo (**PRD-001** …). Cada pasta pode ter `prd.md` (especificação), `plan.md` (plano técnico / fases) ou vários ficheiros (ex.: spec + anexos).

| ID | Título | Conteúdo | Estado (alto nível) |
|----|--------|----------|---------------------|
| **PRD-001** | Chrome Extension — feedback QA → GitHub | [prd.md](PRD-001-chrome-extension-qa-feedback/prd.md) | Especificação fundacional do produto |
| **PRD-002** | Contexto rico — spec (`features`) + rotas | [features.md](PRD-002-features-context-spec/features.md), [routes.go](PRD-002-features-context-spec/routes.go) | Referência viva de requisitos; `routes.go` só documentação para mapear rotas SPA |
| **PRD-003** | Contexto rico na issue — plano por fases | [plan.md](PRD-003-context-rich-issues/plan.md) | Phases 0–5 na `main` (merge [PR #6](https://github.com/jorgsouza/QAFeedback/pull/6)); Phase 6 opcional |
| **PRD-004** | Rota SPA + chip na UI + contexto técnico | [plan.md](PRD-004-spa-page-route-context/plan.md) | Implementado na `main` (ver secção 8 do plano) |
| **PRD-005** | Painel canto + board Jira no modal + allowlist | [plan.md](PRD-005-jira-board-panel-filter/plan.md) | Implementado na `main` (ver secção 6 do plano) |
| **PRD-006** | Modo diagnóstico HAR + anexo Jira | [plan.md](PRD-006-network-har-diagnostic/plan.md) | Implementado (CDP + anexo; ver código e `DOCUMENTATION.md`) |
| **PRD-007** | Layout Figma / Trust DS / título 4 palavras | [plan.md](PRD-007-figma-layout-qa-automation-trust-ds/plan.md) | UI em evolução; validar critérios de aceite no doc |
| **PRD-008** | Captura por região (viewport) → Jira | [plan.md](PRD-008-region-capture-jira/plan.md) | Implementado no código; atualizar checkboxes do plano se QA validar |

## Recursos partilhados

- **Ícone / mascote:** [assets/capiQA.png](assets/capiQA.png) — usado pelo script `extension/scripts/roundify-capiqa.mjs` no build.

## Migração das pastas antigas

- Conteúdo que estava na pasta **`PRD/`** (histórico) e em **`plans/`** foi movido para **`prd/PRD-00x-…/`**. A pasta **`PRD/`** deixou de existir no repositório.
- Atalho restante: [plans/README.md](../plans/README.md).
