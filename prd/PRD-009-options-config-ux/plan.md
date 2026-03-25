# Plano: UX da página de opções — implementação por fatias

> **PRD de origem:** [prd.md](./prd.md) — **PRD-009**  
> **Branch:** `feature/options-config-ux-refactor`  
> **Índice:** [`prd/INDEX.md`](../INDEX.md)

Este plano traduz o PRD-009 em **fatias verticais** verificáveis: cada fase entrega um comportamento completo na página de opções (carregar → usar → guardar), **sem** alterar o contrato de dados salvo em `chrome.storage.local`, salvo onde a Fase 2 escolher explicitamente o caminho com botão (e mesmo assim preservando os mesmos handlers de mensagem ao service worker).

---

## Decisões de arquitetura (duráveis)

| Decisão | Escolha |
|---------|---------|
| **Modelo de dados** | `ExtensionSettings` e campos persistidos **inalterados** em todas as fases, exceto se Fase 2-B exigir um flag puramente de UI (preferir **não** adicionar campo persistido só para UI; usar estado React). |
| **Persistência** | `saveSettings` continua a ser a única escrita canónica após edição válida; `onSave` mantém validações e **`chrome.permissions.request`** para hosts Jira + lista de domínios. |
| **Jira — descoberta** | Enquanto Fase 2 não decidir pelo caminho **B**, o `useEffect` que depende de `jiraCredsReady` continua a disparar listagem com debounce (~550 ms) e `sendJiraTestAndListBoards` — **mesma assinatura de mensagem** ao service worker. |
| **Allowlist de quadros** | `filterJiraBoardsByAllowlist` / `builtInJiraBoardAllowlistIds` permanecem na cadeia que alimenta o `<select>`; apenas a **apresentação** muda. |
| **GitHub** | `TEST_GITHUB`, fluxo de repos no textarea e token — mesma semântica; ajuda “Como criar token” passa a UI colapsável, não a lógica. |
| **Superfície principal** | Página de opções MV3 (bundle atual); estilos podem permanecer inline ou bloco `<style>` no componente, ou extrair para módulo CSS **dentro** da pasta de opções se reduzir ruído, sem alterar `manifest` salvo necessidade técnica. |

### Contratos que **não** podem regredir (qualquer fase)

`ExtensionSettings`, `onSave`, `jiraCredsReady`, `sendJiraTestAndListBoards`, `onJiraBoardSelect`, `saveSettings` nos fluxos atuais, filtro allowlist de boards, `chrome.permissions.request` ao guardar quando há hosts novos — conforme [prd.md §6](./prd.md).

---

## Fase 1: Hierarquia visual e microcopy (sem mudar lógica)

**Cobertura do PRD:** Fase 1 do PRD (accordion ajuda, blocos Jira, secções dedicadas, badges, rótulos).

### O que construir

1. **Accordion “Como criar o token”**  
   O conteúdo longo de GitHub (e o equivalente de Jira, se existir como bloco sempre visível) passa para **`<details>` fechado por defeito** (ou um único accordion “Ajuda: tokens” com subsecções). O utilizador expande só quando precisa; campos de token e ações **permanecem** visíveis fora do accordion.

2. **Jira em dois blocos visuais**  
   - **Conexão:** e-mail, API token, secção “Avançado” (site, etc.) se já existir agrupada — só **ordem e títulos** (`<h2>` / landmarks), não novos campos.  
   - **Board padrão:** `<select>` de quadro + copy que explica backlog destino e allowlist de build.

3. **Secções dedicadas**  
   - **Captura avançada:** agrupar opções como modo diagnóstico HAR / rede completa (o que hoje já existe) sob cabeçalho e eventual `details` opcional.  
   - **Domínios permitidos:** textarea + explicação de permissão num bloco próprio, separado visualmente de GitHub/Jira.

4. **Badges de estado** (derivados só de estado já existente)  
   Exemplos: “GitHub: token preenchido” / “GitHub: não configurado”; “Jira: credenciais OK” quando `jiraCredsReady`; “A carregar quadros…” quando `jiraBoardsLoading`; indicador breve quando `testing` / `testingJira`. **Não** inventar novas chamadas de API só para badge.

5. **Microcopy**  
   Revisar rótulos, `aria-label` onde faltar, e mensagens de topo (`status`) para serem **consistentes** com a nova hierarquia (ex.: prefixar “GitHub:” / “Jira:” quando ainda for um único `status` global nesta fase).

### Critérios de aceite

- [ ] Salvar, testar GitHub, preencher Jira, escolher quadro e allowlist comportam-se **igual** ao antes (happy path manual).
- [ ] Permissões: ao salvar com hosts novos, o fluxo de `chrome.permissions.request` ainda corre e as mensagens fazem sentido.
- [ ] Ajuda de criação de token **não** ocupa a dobra inteira com a página aberta (accordion fechado por defeito).
- [ ] Estrutura semântica clara: cabeçalhos por área (GitHub, Jira — Conexão / Board, Captura avançada, Domínios).

### Verificação manual mínima

1. Só GitHub configurado → salvar → site permitido.  
2. Só Jira → credenciais → lista de quadros → escolher board → salvar.  
3. Allowlist no build: lista filtrada e mensagem quando vazia por filtro.  
4. Token GitHub testar conexão.

---

## Fase 2: Conexão Jira perceptível (auto-load melhorado **ou** botão explícito)

**Cobertura do PRD:** Fase 2 do PRD — **decisão de produto antes de codar o caminho B.**

### O que construir

**Caminho A (recomendado primeiro — menor risco)**  
- Manter o `useEffect` atual que lista quadros quando `jiraCredsReady`.  
- Adicionar **feedback explícito** na UI: spinner/“A atualizar quadros…”, timestamp ou texto “Última lista: agora” após sucesso, e **área de erro só Jira** (pode ainda alimentar o mesmo `setStatus` mas com copy que identifique o bloco).  
- Garantir que falhas de `sendJiraTestAndListBoards` **continuam** visíveis e que `onJiraBoardSelect` não fica bloqueado silenciosamente.

**Caminho B (opcional — maior risco)**  
- Remover ou condicionar o auto-fetch: lista vazia até o utilizador clicar **“Conectar Jira”** ou **“Atualizar quadros”**.  
- O clique chama a **mesma** função que hoje o efeito chama (mesma mensagem ao SW).  
- Tratar **antes de salvar**: credenciais só no estado local devem permitir o botão de teste sem persistir tudo (se já for possível hoje, documentar; se não, alinhar com PRD e não quebrar `onSave`).

### Critérios de aceite

- [ ] Utilizador identifica **quando** há pedido em curso ao Jira e **qual** o resultado (sucesso / erro / lista vazia por allowlist).
- [ ] `sendJiraTestAndListBoards` e `onJiraBoardSelect` permanecem funcionais; allowlist intacta.
- [ ] Se Caminho B: regressão testada em “credenciais novas sem salvar” vs “após salvar”.

### Verificação manual mínima

- Credenciais inválidas → erro legível na área Jira.  
- Credenciais válidas → lista preenchida; escolher board → `saveSettings` com projeto/filtro como hoje.  
- Troca de email/token → nova lista sem estado “fantasma”.

---

## Fase 3: Estados por secção e feedback previsível

**Cobertura do PRD:** Fase 3 do PRD.

### O que construir

1. **Modelo de UI (máquina de estados leve)**  
   Para cada área relevante (GitHub, Jira, Domínios — e opcionalmente “Salvar global”), manter estados do tipo: `idle` | `loading` | `success` | `error`, **derivados** de `testing`, `testingJira`, `jiraBoardsLoading`, resultado de `onSave`, etc. Evitar duplicar fonte de verdade: um hook ou objeto `sectionStatus` calculado a partir dos flags existentes.

2. **Mensagens por secção**  
   Reduzir dependência de um único `status` string para tudo; preferir **blocos** abaixo de cada secção (ou `role="status"` por região) com a última mensagem **dessa** operação. O botão Salvar pode manter um resumo curto global se útil.

3. **Alinhamento com “Salvar”**  
   Copy explicando que permissões de host são pedidas ao salvar; badges após salvo bem-sucedido coerentes com o que ficou persistido.

### Critérios de aceite

- [ ] QA percorre happy path e 2–3 falhas (token GitHub vazio, Jira falha API, domínios vazios) **sem ambiguidade** de qual secção falhou.
- [ ] Nenhuma regressão nos contratos da § “não quebrar” do [prd.md](./prd.md).
- [ ] Acessibilidade: foco e leitores de ecrã recebem anúncio de erro na região correta (mínimo: `aria-live` por secção ou uma região live por prioridade).

### Verificação manual mínima

- Disparar erro GitHub e erro Jira na mesma sessão — ambos visíveis e distinguíveis.  
- Salvar com sucesso após erro — estados limpos ou atualizados de forma previsível.

---

## Ordem de execução

1. **Fase 1** → merge ou PR dedicado quando estável.  
2. **Decisão escrita** no PR: Caminho A ou B para Fase 2.  
3. **Fase 2** → Fase 3 (pode iniciar modelação de estados na Fase 1 com stubs, mas consolidar na Fase 3).

---

## Documentação

Após Fase 1 estável: atualizar trechos relevantes em `extension/DOCUMENTATION.md` e/ou `extension/README.md` que descrevem a página de opções (sem obrigatoriedade de screenshots).

---

## Resumo de fases (tracer bullets)

| Fase | Fatia vertical | Demonstrável quando |
|------|----------------|----------------------|
| **1** | Nova hierarquia + accordion + badges + secções | Abrir opções, colapsar ajuda, configurar e salvar sem mudança de dados |
| **2** | Jira: feedback claro ou botão explícito | Ver estado de ligação/listagem Jira de ponta a ponta |
| **3** | Estados e mensagens por secção | Simular erros por bloco e salvar com feedback claro |
