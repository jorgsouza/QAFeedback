# Plano: painel acoplado ao canto + minimizar + Board Jira no modal (filtro por ID)

> Pedido em **dois** eixos: (1) layout tipo *sheet* no canto, minimizar com seta, restaurar pelo FAB capivara; (2) bloco "Board do Jira para vincular" alimentado pela mesma fonte que "Quadro Software — backlog destino" nas opções, com filtro de IDs (ex.: `.env` linhas 20–21 `BOARD_ID=455,451,…`).

---

## 1. Viabilidade — resumo

| Pedido | Viável? | Notas |
|--------|---------|--------|
| Painel no canto + minimizar (seta) + reabrir pelo FAB | **Sim** | Só UI/posicionamento e estado React no `FeedbackApp`; hoje o modal é centralizado (`.qaf-modal`). |
| Lista de boards no modal ligada à config Jira | **Sim** | Já existe `JIRA_TEST_AND_LIST_BOARDS` + `listJiraBoards` / quadro nas opções; falta **expor lista filtrada** ao content e **persistir escolha por envio**. |
| Filtro só com IDs de `BOARD_ID` no `.env` | **Sim, com ressalva** | A extensão **não lê `.env` no runtime**. Opções: variáveis **`VITE_…`** no build (Vite `loadEnv`) ou campo nas **opções** (allowlist editável). |

**Risco de segurança (importante):** arquivos `.env` com **API token Jira** não devem ser empacotados na extensão nem commitados. Usar apenas **IDs de quadro** como allowlist é seguro; credenciais continuam só em `chrome.storage` / opções.

---

## 2. Ponto 1 — Layout no canto, minimizar e FAB

### 2.1 Comportamento alvo (alinhado aos mocks)

- Com o painel **ab**, fixar à **direita** (ou canto inferior-direito como *drawer*), largura ~377px (Figma), altura ~90vh, sombra/borda como já definido em `shadow-styles`.
- **Botão seta à esquerda** no header (ex.: ícone *panel-left* / "recolher"): **não** fecha o fluxo nem limpa o formulário — apenas **colapsa** o painel para o estado "só FAB" (igual filosofia ao minimizar atual, mas explícito no mock).
- Clicar de novo no **FAB (capivara)** com painel colapsado: **reexpande** o painel com o mesmo estado anterior (formulário preservado).
- O **× fechar** pode continuar a fazer *close + reset* (comportamento atual) ou alinhar ao mock (só fechar); recomenda-se manter **× = fechar e limpar** e **seta = só ocultar painel**.

### 2.2 Implementação técnica

- Novo estado: ex. `panelCollapsed` (boolean) **ou** reutilizar `minimized` com semântica clara: hoje `minimized` esconde texto "Minimizar" do FAB; convém separar **FAB colapsado** vs **painel recolhido com form em memória**.
- CSS: substituir `left: 50%; top: 50%; transform: translate(-50%, -50%)` por `top: 0; right: 0; bottom: 0` (ou `top: auto; bottom: 16px; right: 16px; max-height: …`) conforme alvo visual; animação opcional `transform: translateX`.
- Ajustar **backdrop**: nos mocks o painel pode ser só *sheet* sem escurecer a página inteira — decisão de UX (com ou sem overlay).
- **Acessibilidade:** `aria-expanded` no botão de recolher; foco preso ou devolvido ao FAB ao colapsar.

### 2.3 Critérios de aceite (ponto 1)

- [ ] Painel ancorado ao canto/direita como nos prints.
- [ ] Seta à esquerda recolhe o painel; FAB permanece; capivara reabre com dados intactos.
- [ ] Sem regressão em FAB minimizado atual (se mantido), ou documentar unificação dos dois modos.

---

## 3. Ponto 2 — Board Jira no modal + filtro de IDs

### 3.1 Estado atual (código)

- **Opções:** "Quadro Software — backlog destino" grava `jiraSoftwareBoardId` e resolve projeto / filter (já existente).
- **`CREATE_ISSUE`:** usa sempre `s.jiraSoftwareBoardId` do storage — **não** aceita quadro escolhido no modal.
- **`LIST_REPO_TARGETS`:** devolve repos GitHub e flags; **não** devolve lista de quadros Jira.

### 3.2 Comportamento alvo

1. Ao abrir o modal (ou ao escolher destino Jira), pedir ao SW uma lista de quadros **mesma origem** que nas opções (`JIRA_TEST_AND_LIST_BOARDS` / `listJiraBoards` com `projectKey` derivado do quadro configurado quando necessário).
2. **Filtrar** a lista: manter só boards cujo `id` ∈ conjunto permitido (**allowlist**).
3. Usuário escolhe um quadro no `<select>` do modal; no **envio**, passar esse **board id** para `CREATE_ISSUE` e usar **esse** id em `createJiraIssue` + `jiraResolvedBoardWebUrl` em vez do único valor guardado (ou validar que o id escolhido é subconjunto dos permitidos).

### 3.3 Allowlist `BOARD_ID` (`.env` 20–21)

- **Em desenvolvimento:** `extension/.env` ou raiz com `VITE_JIRA_BOARD_ALLOWLIST=455,451,453,...` e no `vite.config.ts` usar `loadEnv` + `define` para injetar no bundle do **content** (e SW se precisar da mesma lista).
- **Em produção / usuários finais:** allowlist precisa existir no artefato construído **ou** campo opcional nas opções ("IDs de quadro permitidos (opcional)") para não depender de máquina do desenvolvedor.
- **Validação:** se allowlist vazia → comportamento atual (sem filtro) **ou** política estrita (erro) — definir com produto.

### 3.4 Mensagens / contratos

- Estender `LIST_REPO_TARGETS` **ou** criar `LIST_JIRA_BOARDS_FOR_FEEDBACK` que retorne `{ boards: { id: number; name: string }[], defaultBoardId?: string }` já filtrado.
- Estender `CREATE_ISSUE` com `jiraSoftwareBoardId?: string` no `message`: quando presente e válido, substitui o de storage só para aquela criação; validar contra lista retornada + allowlist.

### 3.5 Critérios de aceite (ponto 2)

- [ ] Dropdown no modal lista apenas quadros permitidos pela allowlist (IDs de `.env` / `VITE_…`).
- [ ] Issue criada no board **selecionado**; link "quadro" coerente com esse id.
- [ ] Opções continuam a ser a fonte de credenciais e quadro "padrão" / resolução de projeto; modal não duplica tokens.

---

## 4. Fases sugeridas

| Fase | Conteúdo |
|------|-----------|
| **A** | Vite `loadEnv` + `VITE_JIRA_BOARD_ALLOWLIST`; módulo `parseBoardAllowlist.ts` + testes. |
| **B** | SW: listagem + filtro; resposta ao content; validação no `CREATE_ISSUE`. |
| **C** | `FeedbackApp`: estado `selectedJiraBoardId`, `<select>`, load ao abrir; payload no `sendMessage`. |
| **D** | UI: painel canto direito + `panelCollapsed` + botão seta + integração FAB. |
| **E** | Docs (`README` / `DOCUMENTATION.md`): variável de build, opção futura, **não commitar secrets**. |

---

## 5. Dependências e riscos

- **Ordem:** Fase **B+C** pode ir antes de **D** se quiser entregar valor de dados primeiro.
- **Performance:** cachear lista de boards em memória na sessão do modal para não spammar API.
- **Edge case:** allowlist com IDs que a API não devolve → lista vazia; mostrar mensagem clara.
- **Git:** garantir `.env` no `.gitignore` (tokens); só exemplo `env.example` com `VITE_JIRA_BOARD_ALLOWLIST`.

---

## 6. Estado da implementação (atualizado)

Implementado na linha **`feature/qa-automation-layout-trust-ds`** (merge alvo: `main`):

- **Allowlist de quadros:** `BOARD_ID` ou `VITE_JIRA_BOARD_ALLOWLIST` no `.env` (raiz ou `extension/`) → Vite injeta em build; `jira-board-allowlist.ts` + listagem ordenada em opções e no modal.
- **`LIST_REPO_TARGETS`:** devolve `jiraBoards`, `jiraDefaultBoardId` e eventual `jiraBoardsError`.
- **`CREATE_ISSUE`:** aceita **`jiraSoftwareBoardId`** opcional no payload (quadro só para aquele envio), validado contra a lista filtrada.
- **UI:** painel em sheet à direita, recolher com seta, FAB reabre; seletor **Board do Jira para vincular** no formulário quando há Jira.
- **Docs:** `README.md` (raiz e `extension/`) e `DOCUMENTATION.md` descrevem allowlist, modal e tipo Task quando o filtro do quadro exclui Bug.

### Próximos ajustes opcionais

1. Revisar **backdrop** (opacidade / clique fora) e comportamento exato do **×** vs rascunho.
2. Critérios de aceite nas seções 2.3 / 3.x: marcar checkboxes conforme QA validar em produção.
