# Plano: layout Figma “QA Automation — plugin” + alinhamento PDF / Trust DS

> Objetivo: validar vi técnica de reproduzir o fluxo e a hierarquia visual do PDF **QA Automation — plugin** (referência Reclame AQUI / RA Inspector) e do frame Figma indicado, aplicando **Trust DS** onde fizer sentido na extensão Chrome (Shadow DOM).

## 1. Resultado da validação (viabilidade)

**Conclusão: é viável implementar a experiência descrita no PDF com a stack atual (React + content script + modal em Shadow DOM + Jira/GitHub).** O código já cobre a maior parte dos comportamentos; o trabalho principal é **redesign de UI/UX** (layout, componentes visuais, escolha de board no modal) e **adesão visual aos tokens/padrões Trust DS** (com ou sem pacote `@trust/ds`).

### 1.1 Figma MCP — bloqueio atual

Ao consultar o arquivo via MCP (`fileKey` `6hLsb9blQzsbJglPIKwDci`, nó `11:3550`), a API respondeu **403 Forbidden**.

**Interpretação:** o token/usuário usado pelo servidor Figma não tem permissão de leitura nesse arquivo (privado, time errado, ou token sem escopo `file_read`).

**Para validar o layout pixel-a-pixel com o Figma:**

1. Garantir que a conta do token Figma tenha acesso de **viewer** (ou superior) ao arquivo.
2. Regenerar/configurar o **Personal Access Token** com escopos adequados (leitura de files).
3. Alternativa sem API: exportar **frames** ou **especificação** (Inspect) e anexar ao repositório ou colar medidas/tokens manualmente neste plano.

Até o 403 ser resolvido, a **fonte de verdade visual** para este plano fica: **PDF exportado** + **código atual** + **Trust DS (RAG)**.

### 1.2 PDF vs implementação atual (matriz rápida)

| Elemento no PDF | Estado atual na extensão | Gap principal |
|-----------------|-------------------------|---------------|
| Cabeçalho (“RA Inspector” / subtítulo produto) | Título genérico de feedback | Textos/branding configuráveis ou alinhados ao produto |
| **Board do Jira para vincular** (dropdown no formulário) | Board escolhido só em **Opções** | **Seleção de board no modal** (lista via API já usada em Options) |
| **Motivo de abertura** (chips: Desenvolvimento, Design, …) | `<select>` com as **mesmas 7 strings** (`jira-motivo.ts`) | Trocar **select → grupo de chips** (mesmo valor enviado ao Jira) |
| Descrição + ditado / voz | Já existe (Chrome + dicas de ditado SO) | Ajuste de copy e hierarquia visual |
| Prints (opcional) 0/8, Selecionar imagem, Capturar tela | Já existe (limite e fluxos) | Labels e disposição como no PDF/Figma |
| Ações: Enviar, Copiar, Cancelar | Existe (ordem pode diferir) | Unificar ordem com design (ex.: Cancelar · Copiar · Enviar) |
| Pós-envio: Evidência criada, links Board/Issue, Copiar, Acessar, Criar novo, Fechar | `postSubmit` com links GitHub/Jira | Enriquecer **telas de sucesso** (copy “Evidência criada”, botões nomeados como no PDF) |

**Jira:** os valores de “Motivo da abertura” no código já coincidem com o PDF — **nenhuma mudança de contrato** se apenas a UI mudar de `<select>` para chips.

### 1.3 Trust DS (RAG) — o que usar no projeto

Do **trust-ds-rag**, para este tipo de interface:

- **Dialog** (`@trust/ds/dialog`): modal com `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, botões primário/secundário.
- **Tokens:** `import '@trust/ds/global.css'` (ou `theme.css` / `trust-theme.css`); uso via **Tailwind** (`bg-primary-700`, etc.) ou **CSS variables** (`var(--primary-700)`).
- **Shadow DOM:** a base de conhecimento indica tratar **modo escuro** aplicando classe `dark` no elemento raiz **dentro** do shadow root (não só no `document.documentElement`).

**Restrição da extensão hoje:** `package.json` da extensão **não** inclui `@trust/ds` nem Tailwind; estilos estão em `shadow-styles.ts` (string CSS). Há dois caminhos realistas:

| Abordagem | Prós | Contras |
|-----------|------|--------|
| **A — Adotar `@trust/ds` + Tailwind no bundle Vite** | Paridade com produtos internos, componentes acessíveis (Radix) | Tamanho do bundle MV3, config de build, garantir estilos **escopados ao shadow root** |
| **B — “DS lite”: espelhar tokens Trust em CSS variables** | Bundle menor, controle total no shadow | Manutenção manual se tokens DS mudarem; sem Radix pronto |
| **C — Híbrida** | Componentes críticos do DS onde couber; resto CSS próprio | Mais decisões de fronteira |

**Recomendação para a primeira entrega do novo layout:** **B ou C** — mapear do Figma/Inspect as variáveis (cores, radius, spacing, tipografia) para `shadow-styles.ts` e, numa fase 2, avaliar `@trust/ds` se o time exigir 100% dos primitivos React.

---

## 2. Branch e escopo do PR

- **Branch sugerida:** `feature/qa-automation-layout-trust-ds` (ou `feature/figma-qa-plugin-ui`).
- **Escopo:** apenas **UI/UX do modal de feedback** (+ telas pós-envio) e **seleção de board Jira no modal**; sem mudar regras de API GitHub/Jira além do necessário para listar/trocar board.

---

## 3. Fases de implementação

### Fase 0 — Destravar Figma e especificação

- [ ] Resolver **403** do Figma ou importar PNG/spec do frame `11-3550`.
- [ ] Checklist de medidas: largura máxima do modal, grid de chips, espaçamentos, ordem da footer, estados hover/disabled/loading.
- [ ] Decisão explícita: **A**, **B** ou **C** (Trust DS pacote vs tokens only).

### Fase 1 — Arquitetura de estado (board no modal)

- [ ] Definir se a lista de boards vem de **mesma mensagem** que Options (`sendJiraTestAndListBoards` / equivalente) ou endpoint dedicado no SW.
- [ ] Persistência: ao escolher board no modal, decidir entre **só sessão**, **gravar em `chrome.storage`** como “último board usado”, ou **substituir** o board global das opções (decisão de produto).
- [ ] Testes: fluxo “Jira OK + múltiplos boards” sem regressão ao enviar issue.

### Fase 2 — Redesign visual (paridade PDF/Figma)

- [ ] Novo **header** (título + subtítulo) conforme design.
- [ ] **Select** de board no formulário (acessível, teclado).
- [ ] **Chips** de motivo (single-select), mantendo strings exatas de `JIRA_MOTIVO_ABERTURA_OPTIONS`.
- [ ] Seção descrição: label, textarea, microfones/ditado com hierarquia visual alinhada.
- [ ] Bloco anexos: contador `x/8`, botões “Selecionar imagem” / “Capturar tela”.
- [ ] **Footer:** botões Cancelar / Copiar / Enviar (habilitação e ordem conforme design).
- [ ] Tema claro/escuro: se o PDF/Figma prever, aplicar estratégia **dark no shadow root** (Trust DS).

### Fase 3 — Tela de sucesso

- [ ] Layout “Evidência criada” com links **Board** e **Issue**, ações **Copiar** / **Acessar**.
- [ ] “Criar novo” limpa formulário e volta ao passo 1; “Fechar” fecha modal.

### Fase 4 — Qualidade

- [ ] `npm run check` e `npm test` verdes.
- [ ] Testes manuais: só Jira, só GitHub, ambos; board trocado no modal; motivo obrigatório; limite de imagens.
- [ ] Atualizar `extension/README.md` / `DOCUMENTATION.md` se fluxo de board mudar para o utilizador.

---

## 4. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Bundle grande com `@trust/ds` | Medir `dist/` antes/depois; tree-shaking; começar por tokens-only |
| Estilos DS não “entram” no Shadow DOM | Injetar CSS do DS dentro do shadow root; evitar depender só do `<head>` da página |
| Listagem de boards lenta no modal | Cache em storage; loading skeleton; reutilizar lógica já estável em Options |
| Figma desatualizado vs PDF | Product owner aponta **uma** fonte; diffs anotados no PR |

---

## 5. Critérios de aceite (macro)

- [ ] Utilizador consegue **escolher o board Jira no modal** (quando há mais de um contexto válido) e enviar issue com **motivo** correto no custom field.
- [ ] UI reflete **chips** de motivo e hierarquia do **PDF** (e do Figma, após acesso).
- [ ] Estilos seguem **Trust DS** na abordagem acordada (pacote ou tokens espelhados), com contraste aceitável.
- [ ] Pós-envio com ações **Copiar/Acessar/Criar novo/Fechar** alinhadas ao fluxo desejado.
- [ ] Nenhuma regressão nos fluxos GitHub e anexos existentes.

---

## 6. Próximo passo imediato recomendado

1. Abrir o Figma com uma conta que o **MCP/token** consiga ler **ou** exportar o frame `11-3550` para imagem + anotar tokens.
2. Criar a branch `feature/qa-automation-layout-trust-ds` a partir de `main`.
3. Implementar **Fase 1** (board no modal) antes do polish visual — reduz risco de integração Jira.
