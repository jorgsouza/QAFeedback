# PRD-009 — UX da página de opções / configuração

> Índice: [`prd/INDEX.md`](../INDEX.md)  
> **Plano de implementação:** [`plan.md`](./plan.md)  
> **Branch sugerida:** `feature/options-config-ux-refactor`

---

## 1. Objetivo

Melhorar a **experiência de configuração** da extensão (página de opções) com **refactor de baixo risco**: reorganizar informação, clarificar fluxos e feedback visual **sem alterar o contrato de dados nem quebrar integrações** (GitHub, Jira, permissões, allowlist de quadros).

## 2. Fora de escopo (neste PRD)

- Mudar o formato persistido de `ExtensionSettings` ou campos armazenados em `chrome.storage.local`.
- Remover ou reescrever do zero o fluxo de `saveSettings` / permissões.
- Alterar a API das mensagens ao service worker, exceto onde a Fase 2 explicitamente decidir por um botão “Conectar Jira” (ver §4).

## 3. Princípio de risco

**Fase 1** = só UI (layout, seções, accordion, rótulos, badges). **Sem** mudar quando disparamos load de quadros ou quando gravamos.

**Fase 2** = decisão de produto sobre **feedback** vs **botão explícito**; se houver botão, implementar com cuidado para não regressar descoberta automática.

**Fase 3** = estados e mensagens por seção; ainda assim, **preservar** os pontos listados na §6.

---

## 4. Fases de entrega

### Fase 1 — Reorganização visual (baixo risco)

**Sem mudar a lógica de negócio.**

| Entrega | Detalhe |
|---------|---------|
| Accordion | Esconder **“Como criar token”** (GitHub e/ou Jira conforme existir hoje) dentro de um **accordion** fechado por padrão. |
| Jira em blocos | Separar **Conexão** (e-mail, token, site se aplicável) de **Board padrão** (quadro Software / backlog destino). |
| Seções dedicadas | **Captura avançada** (ex.: modo diagnóstico HAR, opções de rede) numa seção própria; **Domínios permitidos** em outra seção clara. |
| Microcopy | Melhorar **rótulos**, descrições curtas e textos de ajuda (clareza > volume). |
| Badges de estado | Mostrar **badges** de estado (ex.: token GitHub OK, Jira conectado, permissões pendentes) alinhados ao que o código já sabe (`jiraCredsReady`, testes de conexão, etc.). |

**Critério de aceite Fase 1:** mesmo fluxo de antes (salvar, listar repos, listar quadros, allowlist); apenas a **hierarquia visual** e textos mudam.

### Fase 2 — Clarificar a ação de conexão (Jira)

**Decisão de produto (escolher um caminho):**

1. **Manter auto-load** de quadros quando credenciais estão válidas, e **melhorar feedback** (loading explícito, sucesso/erro visível, última atualização).
2. **Ou** introduzir botão **“Conectar Jira”** / **“Atualizar quadros”** que dispara o mesmo fluxo hoje automático, com estados vazios até a ação.

> **Atenção:** trocar para só botão **altera** a lógica de descoberta automática; exige testes manuais em opções “antes de salvar” vs “depois de salvar”, e não pode quebrar `sendJiraTestAndListBoards` / `onJiraBoardSelect`.

**Critério de aceite Fase 2:** usuário percebe **quando** a app está falando com o Jira e **qual** o resultado; allowlist continua filtrando a lista como hoje.

### Fase 3 — Estados internos e feedback previsível

- Separar **status** em estados explícitos por área (ex.: `idle` | `loading` | `success` | `error` para bloco Jira, bloco GitHub, domínios).
- Mensagens de **erro** e **sucesso** **por seção** (não um único banner genérico quando evitável).
- Reduzir surpresas: o que acontece ao **Salvar** deve estar alinhado com copy e badges.

**Critério de aceite Fase 3:** QA consegue percorrer happy path e falhas comuns sem ambiguidade sobre o estado de cada bloco.

---

## 5. Arquivos prováveis

- `extension/src/options/OptionsApp.tsx` (principal)
- `extension/src/options/main.tsx` (se necessário para tema/layout)
- Estilos: componentes inline / CSS existente da página de opções
- `extension/DOCUMENTATION.md` / `extension/README.md` — atualizar screenshots ou descrição da página de opções **após** Fase 1+ quando estável

---

## 6. Checklist — não quebrar (obrigatório preservar)

Em qualquer fase, **não regressar** estes contratos e fluxos:

| Item | Notas |
|------|--------|
| **`ExtensionSettings`** | Mesmos campos e semântica; só UI pode agrupar visualmente. |
| **`onSave`** | Continua a persistir e a pedir `chrome.permissions.request(...)` quando aplicável ao conjunto de domínios. |
| **`jiraCredsReady`** | Lógica que determina se credenciais Jira estão prontas para listar quadros. |
| **`sendJiraTestAndListBoards`** (ou equivalente) | Mensagem ao SW / handler que lista quadros; Fase 2 não pode silenciar falhas. |
| **`onJiraBoardSelect`** | Seleção de quadro e persistência associada. |
| **`saveSettings(...)`** | Chamado nos mesmos pontos funcionais (ajustar só se Fase 2 alterar gatilhos de forma testada). |
| **Filtro allowlist de boards** | `BOARD_ID` / `VITE_JIRA_BOARD_ALLOWLIST` continua a restringir a lista apresentada. |
| **`chrome.permissions.request`** | Mantém-se no fluxo de **guardar** quando há hosts novos (ou fluxo equivalente atual). |

---

## 7. Ordem recomendada

1. Implementar **Fase 1** na branch `feature/options-config-ux-refactor`.  
2. Validar manualmente GitHub + Jira + domínios + opção de captura avançada.  
3. **Fase 2** após decisão explícita no PR/review.  
4. **Fase 3** pode sobrepor-se parcialmente à Fase 2, mas priorizar estabilidade após Fase 1.

---

## 8. Relação com outros PRDs

- **PRD-011** — maturidade do produto (segurança / detecção OWASP-aware, etc.) permanece **posterior** a este trabalho de UX de configuração.
