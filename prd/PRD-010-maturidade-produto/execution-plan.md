# Plano de execução (tracer bullets): PRD-010 — Maturidade do produto

> **Fonte:** [plan.md](plan.md) (PRD-010 — maturidade, debug interno, segurança pragmática OWASP-aware).  
> **Método:** fases em **fatias verticais** (cada fase entrega comportamento ponta-a-ponta: captura → tipos → issue → UI/opções quando aplicável → testes).

---

## Estado do plano (atualização)

| Fase | Situação |
|------|-----------|
| **1** — Achados sensíveis | **Concluída** |
| **2** — Modos de captura | **Concluída** |
| **3** — Contexto da aplicação | **Concluída** |
| **4** — Correlação ação ↔ rede ↔ erro | **Concluída** |
| **5** — Timeline mais rica | **Concluída** |
| **6** — Preview alinhado ao submit | Pendente |
| **7** — UX e comunicação | Pendente (há entregas parciais; ver nota abaixo) |
| **8** — Base para IA | Pendente |

**Entregas transversais já feitas (ligadas ao PRD-010, fora da numeração estrita):**

- **Painel — carregamento de integrações:** estado `idle` / `loading` / `done` para `LIST_REPO_TARGETS`, evitando falso “sem token” enquanto repos/flags carregam; feedback visual no FAB (`FeedbackApp`, estilos shadow).
- **HAR × lista de domínios:** validação defensiva com `urlMatchesAllowedHosts` antes de anexar o depurador e antes de consumir HAR no Jira (`host-patterns.ts`, `service-worker.ts`); texto nas **Opções** e tooltip do badge **HAR** explicando que o aviso global do Chrome (“started debugging…”) não implica captura de outras abas.

---

## Decisões arquiteturais (duráveis)

Aplicam-se a todas as fases; as fases só variam **comportamento**, não estes alicerces.

- **Sanitização**: manter postura **leve por defeito** (URL sem query/hash; atributos sensíveis por nome; sem endurecimento agressivo global). Reforços são **por modo**, não default cego.
- **Schema de contexto**: evoluções são **incrementais** em `CapturedIssueContext` (ou equivalente): campos opcionais, versão estável, compatível com issues já geradas.
- **Issue (Markdown/ADF)**: novas secções são **aditivas**; texto continua legível sem ferramentas externas; **nunca** imprimir segredos completos no corpo principal — apenas tipo, fonte, severidade sugerida, preview truncado, fingerprint quando fizer sentido.
- **Detecção de segurança**: heurísticas sobre **dados já capturados**; saída sempre **probabilística** (“possível”, “indício”, confiança baixa onde aplicável); fora de âmbito: pentest automático, ASVS completo, análise de servidor.
- **Armazenamento de preferências**: `chrome.storage.local` + objeto `ExtensionSettings` existente; novos campos com defaults que **não empobrecem** o modo debug interno.
- **Superfícies de integração**: `context-collector` consolida; `issue-builder` / narrative renderizam; UI de feedback e página de opções refletem estado e modo sem duplicar regras de negócio.

---

## Fase 1 — Detecção de achados sensíveis na issue

**Histórias / objetivos do PRD-010:** sinalizar exposição indevida (segredos, sessão, PII, misconfiguration visível, injeção heurística fraca, mixed content) **sem** destruir contexto de diagnóstico.

### O quê construir (vertical)

Pipeline que, a partir do snapshot já agregado (rede resumida, console, runtime, DOM alvo, URLs sanitizadas), produz **lista normalizada de achados** e uma secção dedicada na issue (“Achados sensíveis / segurança”), com preview controlado e linguagem não conclusiva.

### Critérios de aceite

- [x] Achados derivam apenas de fontes já presentes na captura; ausência de dados não quebra o fluxo.
- [x] Tipos estáveis para achado (espécie, severidade sugerida, fonte, local/resumo, preview truncado, fingerprint opcional).
- [x] Secção na issue aparece quando houver achados; omitir ou mostrar vazio elegante quando não houver.
- [x] Nenhum token/segredo completo no corpo principal por defeito.
- [x] Testes cobrem casos representativos (JWT-like, Bearer, PII óbvia, mensagem de erro “suspeita” com flag de baixa confiança).

### O que foi entregue (implementação)

- `extension/src/shared/sensitive-findings.ts` + `sensitive-findings.test.ts`: heurísticas e normalização de achados.
- Tipos em `types.ts` (`TechnicalContextPayload` / achados versão estáveis).
- `context-collector.ts`: agrega achados a partir do snapshot existente.
- `issue-builder.ts`: secção dedicada na issue + testes atualizados.

---

## Fase 2 — Modos operacionais de captura

**Histórias / objetivos:** mesmo binário, comportamentos distintos para stage/TST vs produção sensível; default favorece **debug interno**.

### O quê construir (vertical)

Definir modo persistido (ex.: `debug-interno` | `producao-sensivel`) com default seguro para diagnóstico; collector e builder **interpretam o modo**: o que entra no texto da issue, nível de truncagem vs fingerprint, mantendo **sempre** a lista de achados visível de forma útil.

### Critérios de aceite

- [x] Modo configurável em opções (e migrado de `emptySettings` / load com fallback).
- [x] Comparação lado a lado: mesmo contexto bruto produz markdown diferente entre modos onde previsto, sem perda de narrativa essencial.
- [x] Modo default não reduz capacidade atual de debugging.
- [x] Testes de builder ou snapshots de texto cobrem os dois modos.

### O que foi entregue (implementação)

- `extension/src/shared/capture-mode.ts` + `capture-mode.test.ts`: `debug-interno` | `producao-sensivel`, normalização no load.
- `storage.ts` / `types.ts`: campo `captureMode` com default `debug-interno`.
- `context-collector.ts` e `issue-builder.ts`: comportamento por modo (truncagem / fingerprint / texto).
- `OptionsApp.tsx`: radio “Debug interno” / “Produção sensível”; `FeedbackApp.tsx` + `service-worker.ts`: exposição do modo onde necessário (ex.: `LIST_REPO_TARGETS`).

---

## Fase 3 — Contexto da aplicação (ambiente best-effort)

**Histórias / objetivos:** reduzir “não reproduzo” com build, release, tenant, flags, etc., quando a página expõe isso.

### O quê construir (vertical)

Coleta best-effort de meta tags / globais conhecidos / storage allowlist → campo estruturado no contexto → secção “Contexto da aplicação” na issue; limites e truncagem alinhados a `context-limits`.

### Critérios de aceite

- [x] Campo opcional; páginas sem sinais não geram erros nem secção vazia ruidosa.
- [x] Não vazar storage inteiro; apenas chaves allowlist ou estratégia documentada no código.
- [x] Issue mostra só o que é útil e legível (sem dumps gigantes).
- [x] Testes com HTML/mocks mínimos validam extração e ausência de crash.

### O que foi entregue (implementação)

- Novo `extension/src/shared/app-environment-capture.ts` + `app-environment-capture.test.ts`: meta tags (incl. `feature-flag-*` / `experiment-*`), globais string (`__BUILD_ID__`, etc.), `__NEXT_DATA__.buildId` apenas, `__APP_CONFIG__` e **`__INITIAL_STATE__` só no nível topo** (mesmas chaves escalares / flags rasas — sem percorrer árvore Redux), `localStorage` / `sessionStorage` só via **`APP_ENV_STORAGE_KEYS_ALLOWLIST`** (documentado no módulo).
- `context-limits.ts`: limites `appEnvFieldMax`, `appEnvCommitMax`, `appEnvFlagsMax`, chaves/valores de flags.
- `types.ts`: `AppEnvironmentSnapshotV1` / `AppEnvironmentKeyValueV1`, campo opcional `appEnvironment` em `TechnicalContextPayload`.
- `context-collector.ts`: `captureAppEnvironment(window)` em `try/catch`; omite campo se vazio.
- `issue-builder.ts`: secção **Contexto da aplicação** (após achados sensíveis, antes do contexto técnico); linha de schema sem referência obsoleta a “Phase 3”.
- `capture-mode.ts`: em `producao-sensivel`, truncagem mais agressiva de `appEnvironment` (menos flags / valores mais curtos).

---

## Fase 4 — Correlação ação ↔ request ↔ erro ↔ estado visual

**Histórias / objetivos:** narrativa mais investigativa (“após X, request Y, erro Z, estado visual W”) sem afirmações causais excessivas.

### O quê construir (vertical)

Janela temporal e regras de priorização sobre timeline + rede + erros + visual state; enriquecer resumos (ex.: proximidade à última ação, correlação booleana); narrative e cabeçalho/summary da issue refletem **hipótese útil**, não verdade absoluta.

### Critérios de aceite

- [x] Requests/errors mais relevantes sobem na narrative em cenários de teste sintéticos.
- [x] Copy da issue não diz “causado por” quando só há correlação temporal (linguagem explícita de correlação).
- [x] Regressão: issues continham os mesmos blocos obrigatórios anteriores.
- [x] Testes de narrative / collector cobrem ordenação e tie-breaks.

### O que foi entregue (implementação)

- `extension/src/shared/session-correlation.ts` + `session-correlation.test.ts`: âncoras `click` / `submit` / `navigate`, correlação de rede na janela `correlationWindowAfterActionMs`, enriquecimento e escolha do erro “principal” com reordenação (último = destacado no builder).
- `context-limits.ts`: `correlationWindowAfterActionMs` (12s).
- `types.ts`: `NetworkRequestSummaryEntryV1` (`deltaToLastActionMs`, `correlationTriggerKind`, `isCorrelated`); `RuntimeErrorSnapshotV1.deltaToLastActionMs`; ordem dos tipos timeline ajustada.
- `network-summary.ts`: desempate na escolha dos pedidos — correlacionados e mais próximos da âncora sobem.
- `context-collector.ts`: liga correlação antes de `pickNetworkSummariesForIssue`; runtime errors via `enrichAndOrderRuntimeErrors`.
- `issue-narrative.ts`: `buildCorrelationHypothesisMarkdown` + destaque em “Leitura rápida” (sem causalidade forte).
- `issue-builder.ts`: rede e erro principal com notas de correlação temporal.

---

## Fase 5 — Timeline de interação mais rica e legível

**Histórias / objetivos:** fluxo reprodutível (scroll significativo, modais, troca de secções) sem ruído da própria extensão.

### O quê construir (vertical)

Eventos adicionais ou refinados no bridge + timeline + limites: scroll com limiares, modais, abas/seções; dedupe e throttling revisados; resumos mais humanos (aria, testid, texto visível).

### Critérios de aceite

- [x] Novos tipos ou entradas aparecem na timeline da issue quando aplicável.
- [x] Timeline não explode em volume em páginas ruidosas (limites respeitados).
- [x] Interações geradas pela UI da extensão não poluem a timeline.
- [x] Testes de timeline cobrem dedupe e novos tipos.

### O que foi entregue (implementação)

- `types.ts`: novos tipos de timeline `scroll`, `dialog`, `section`.
- `context-limits.ts`: `timelineScrollMinDeltaPx`, `timelineScrollThrottleMs`, `timelineDomMutationDebounceMs`.
- `interaction-timeline.ts`: cliques com `role=tab`, `aria-label` e ordem testid → id → aria → texto; `summarizeTabSectionSelection`, `signatureDialogTitles`.
- `page-bridge.ts`: listener de scroll (passive) com limiar + throttle; `MutationObserver` com debounce para mudanças de modal e de aba (`aria-selected`); continua a ignorar eventos da UI da extensão via `eventPathTouchesQaExtensionHost`.
- `issue-builder.ts` / `issue-narrative.ts`: rótulos PT para os novos tipos; leitura rápida com contagens de scroll/modal/aba.
- `interaction-timeline.test.ts`: casos para tab, aria-label, tabs e dialog.

---

## Fase 6 — Preview alinhado ao submit

**Histórias / objetivos:** o que o QA vê no preview é o mesmo núcleo de payload que segue para Jira/GitHub (menos divergência).

### O quê construir (vertical)

Um caminho único para montar “issue atual” usado por preview e envio; refresh em momentos definidos (abrir preview, request relevante nova, erro relevante, ação importante); opcional: indicador de “contexto atualizado”.

### Critérios de aceite

- [ ] Preview e submit partilham helper/builder comum.
- [ ] Casos manuais: alterar rede/erro após abrir preview comporta-se como especificado.
- [ ] Sem loops de renderização ou custo excessivo no painel.
- [ ] Testes cobrem o builder partilhado.

---

## Fase 7 — UX e comunicação

**Histórias / objetivos:** UI reflete capacidades reais (contexto técnico, achados, modos, rede).

### O quê construir (vertical)

Copys em `FeedbackApp` / labels: o que é capturado, avisos de achados sensíveis, modo atual, captura de rede; remover referências a fases internas obsoletas (“Phase 3” → versão de schema neutra).

### Critérios de aceite

- [ ] Textos alinhados ao comportamento pós-fases 1–6.
- [ ] Utilizador percebe modo ativo e se houve achados (sem alarmismo).
- [ ] Não há promessas que o código não cumpre.
- [ ] Revisão rápida visual (smoke) nos fluxos principais.

---

## Fase 8 — Base para IA (sem integração externa)

**Histórias / objetivos:** estrutura explícita “bruto vs resumido vs saída” + objeto estável para futura classificação/título.

### O quê construir (vertical)

Separar conceitualmente camadas no código (tipos/helpers): input agregado para IA inclui ação principal, request principal, erro principal, visual state, ambiente app, **achados sensíveis**; **sem** chamadas a API de modelo.

### Critérios de aceite

- [ ] Helper ou tipos documentam contrato do futuro input IA.
- [ ] Build de issue atual não depende de IA; nenhuma chave/API nova obrigatória.
- [ ] Testes garantem serialização estável ou snapshot do objeto de input em cenário fixo.

---

## Ordem de execução

Executar **na ordem das fases 1 → 8** (como no [plan.md](plan.md) §6): segurança-informativa e modos primeiro; depois contexto app e correlação; em seguida timeline e preview; por fim UX e gancho IA.

**Próximo passo sugerido:** **Fase 6** (preview alinhado ao submit).

---

## Como validar cada fase (operacional)

- Gerar issue de teste em página de exemplo com console/rede/erro controlados.
- Confirmar Markdown (ou ADF) no destino usado pelo time (Jira/GitHub).
- Regressão: toggle “incluir contexto técnico”, envio com rede desligada/ligada, hosts allowlist.
- Revisar ausência de dados sensíveis completos no corpo.
