# Plano: Rótulo de rota na UI + contexto técnico (mitigação total SPA)

> **Objetivo:** mostrar à esquerda das bolinhas de estado (ex.: Jira OK) um indicador da **rota atual** (`pathname` e/ou rótulo amigável tipo *Home*, *Empresa*, *Lista de reclamação*) e **persistir** `pathname` + rótulo no **contexto técnico** enviado nas issues.  
> **Referência opcional de produto:** `PRD/routes.go` (só documentação; **não** é dependência de runtime na extensão).

---

## 1. Problema: SPA e URL sem reload

Em apps que usam **History API** (`pushState` / `replaceState`), a barra de endereços muda **sem** recarregar o documento. Se o React só leu `window.location` no mount, o **rótulo na UI** e o **`useMemo` do payload** podem ficar **desatualizados** até o utilizador mexer noutro estado (ex.: campo do formulário).

**Estado atual do código:** `payload` em `FeedbackApp.tsx` depende de `[form, lastTarget]` — **não** reage a mudanças de URL. Ou seja, hoje o **URL no contexto técnico** também pode ficar stale após navegação SPA com o modal aberto ou entre abrir o modal e enviar.

Este plano corrige isso **de propósito**, não só para o rótulo.

---

## 2. Mitigação em camadas (“100%” do que é observável)

Não existe magia para URLs que **nunca** passam pelo `location` do top-level (ex.: navegação só dentro de `iframe` de outro origin). Para o **documento da aba** onde a extensão corre, a combinação abaixo cobre **todas** as formas normais de mudar a URL sem reload.

| Camada | O quê | Garante |
|--------|--------|---------|
| **A** | `window.addEventListener("popstate", …)` | Voltar / avançar do browser. |
| **B** | Interceptar **uma vez** `history.pushState` e `history.replaceState` (guardar referência original, wrapper que chama o original e depois notifica). | Navegação programática típica de React Router, Next, etc. |
| **C** | `window.addEventListener("hashchange", …)` | Apps baseadas em `#/rota`. |
| **D** | **`pageshow`** com `event.persisted` (back-forward cache) ou foco no separador (`visibilitychange`) para re-ler `location` quando a aba volta. | Recuperação após BFCache / troca de aba. |
| **E (autoridade)** | No **`submit`**, antes de `CREATE_ISSUE`, **reconstruir** `technicalContext` com `buildTechnicalContext` usando **`window.location` atual** (e bridge/target atuais). Não confiar só no `useMemo` em cache para o envio. | **Garantia forte:** o que vai para GitHub/Jira reflete a URL **no instante do envio**. |
| **F (UI)** | Estado React `routeTick` ou `{ pathname, search, label }` atualizado pelos listeners A–D; incluir nas dependências do `useMemo` do `payload` **ou** derivar rótulo só desse estado para o chip na UI. | Rótulo na UI **acompanha** a navegação sem precisar mexer no formulário. |

**Definição honesta de “100%”:**

- **Dados na issue (contexto técnico):** com a camada **E**, fica **alinhado à URL real no momento do envio** — isto é o requisito crítico para QA.
- **Pré-visualização (Preview):** com **F** + dependências corretas no `useMemo`, o Markdown do preview atualiza quando a rota muda.
- **Casos extremos:** micro-frontends em `iframe` sem alterar o `location` do top; `about:` / extensões — fora do escopo do Reclame AQUI; documentar como *não suportado*.

---

## 3. Desenho técnico

### 3.1 Módulo puro: resolver rota → rótulo

- Novo ficheiro, ex.: `extension/src/shared/page-route-context.ts` (nome ajustável).
- **`resolvePageRouteInfo(location: Pick<Location, "pathname" | "search" | "hostname">): { pathname: string; search: string; label: string; routeKey: string }`**
  - `pathname` / `search`: normalizados (trim, opcionalmente colapsar `//`).
  - Regras **ordenadas** (mais específico primeiro): prefixos e regex inspirados no que QA precisa (ex.: `/home`, `/empresa/`, padrões de reclamação — lista fechada inicial, expandir com o tempo).
  - Fallback: `label = pathname` ou `"Outra"` + pathname curto; `routeKey` estável para métricas (`unknown`, `home`, `empresa`, …).
- **Testes Vitest:** tabela de entradas/saídas; sem `window` global se passares `location` como argumento.

### 3.2 Subscrição à navegação (content / mesma janela)

- Novo ficheiro, ex.: `extension/src/shared/location-subscription.ts`:
  - `subscribeToLocationChanges(cb: () => void): () => void` — regista A+B+C+D, faz patch idempotente de `history` (flag em `WeakMap` por `window` ou `Symbol` no próprio `history`).
  - Documentar que o patch é **por frame** da página; se RA usar múltiplos documentos raros, um listener por instância do content script é suficiente.

### 3.3 UI (`FeedbackApp.tsx`)

- `useEffect` + `subscribeToLocationChanges` → `setRouteInfo(resolvePageRouteInfo(window.location))`.
- Na **faixa de estado** (`qaf-status-strip`), à **esquerda** das bolinhas: elemento compacto, ex. `<span class="qaf-route-chip" title={fullPath}>${label}</span>` ou pathname truncado.
- **A11y:** `title` com pathname + search; `aria-label` descritivo.

### 3.4 Tipos e contexto técnico

- Em `TechnicalContextPayload.page`, acrescentar campos opcionais ou obrigatórios:
  - `pathname: string`
  - `routeSearch: string` (ou incluir em `url` já existente — hoje `url` é href completo; pathname explícito ajuda leitura)
  - `routeLabel: string`
  - `routeKey: string` (opcional, para filtros internos)
- `buildTechnicalContext` em `context-collector.ts`: chamar `resolvePageRouteInfo(window.location)` e preencher os campos.
- `buildIssueBody` / secção Markdown do contexto técnico: uma linha tipo **Rota:** `label` (`pathname`).

### 3.5 Envio (camada E)

- Extrair função **`buildPayloadForSubmit()`** ou, dentro de `submit()`, recalcular:
  - `technicalContext = form.includeTechnicalContext ? buildTechnicalContext({ lastTarget, bridge: readBridgeSnapshot() }) : undefined`
  - merge no objeto enviado a `CREATE_ISSUE`.
- Assim, mesmo que algum listener falhe num edge case, o **envio** usa sempre `location` atual.

---

## 4. Ordem de implementação (TDD onde couber)

1. `resolvePageRouteInfo` + testes (regras mínimas: `/home`, `/empresa/`, 1–2 padrões de reclamação acordados com QA).
2. `subscribeToLocationChanges` + testes com `vi.spyOn(history, "pushState")` e evento `popstate` (jsdom limitado — onde falhar, testar funções puras + integração manual).
3. Estender `types.ts` + `buildTechnicalContext` + teste de snapshot do Markdown em `issue-builder.test.ts`.
4. `FeedbackApp`: estado de rota, chip na UI, **refactor do submit** para camada E.
5. `shadow-styles.ts`: estilos do chip (truncar com ellipsis, max-width).

---

## 5. Critérios de aceite

- [ ] Com modal **aberto**, navegar SPA (link interno) de `/home` para `/empresa/…` **sem** mexer no formulário: o **chip** e o **Preview** (com contexto ligado) mostram a rota nova.
- [ ] Clicar **Enviar** após essa navegação: corpo da issue no GitHub/Jira inclui **pathname/label** da URL **final**.
- [ ] **Voltar** no browser (`popstate`): chip atualiza.
- [ ] App só com **hash** routing: `hashchange` atualiza (se aplicável ao RA; senão marcar N/A após validação).
- [ ] `npm run check` e `npm test` passam.

---

## 6. Fora de escopo (v1)

- Gerar regras automaticamente a partir de `routes.go` (pode ser fase 2 com script de build).
- Traduzir rótulos para EN.
- Detetar rota “lógica” dentro de iframe de outro origin.

---

## 7. Riscos residuais (explícitos)

| Risco | Mitigação |
|--------|-----------|
| Framework repõe `history.pushState` | Patch idempotente + re-aplicar em `pageshow` se necessário (raro). |
| Navegação só dentro de iframe | Não coberto; URL do top não muda — documentar. |

Com as camadas **A–F**, o requisito **“rótulo + contexto alinhados à URL em SPAs normais”** fica **cumprido**; a **E** assegura que o **registo na issue** nunca depende só de estado React desatualizado.

---

## 8. Implementação (branch `feature/page-route-context-spa`)

- `extension/src/shared/page-route-context.ts` — `resolvePageRouteInfo` + testes.
- `extension/src/shared/location-subscription.ts` — listeners + patch de `history` + testes.
- `types.ts` — campos `pathname`, `routeSearch`, `routeLabel`, `routeKey` em `TechnicalContextPayload.page`.
- `context-collector.ts` / `issue-builder.ts` — preenchimento e linha **Rota:** no Markdown.
- `FeedbackApp.tsx` — chip na faixa de estado, `routeRevision` no `useMemo` do payload, contexto técnico reconstruído no `submit`.
- `shadow-styles.ts` — `.qaf-route-chip`, `.qaf-status-strip-trailing`.

**Evolução:** o chip e o payload usam **`routeSlug`** (`ra-notifications`, `ra-home`, …); `routeLabel` permanece em PT no Markdown. Paths sem regra explícita → `pathnameToFallbackSlug` (`ra-minha-conta-perfil`, etc.).
