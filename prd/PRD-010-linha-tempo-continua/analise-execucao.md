# Análise de execução — PRD-010 (linha do tempo contínua, mesma aba, multi-URL)

**Especificação:** [prd.md](prd.md)  
**Data:** 2026-03-26  
**Estado:** implementação integrada na branch **`main`** (não depende de uma branch de documento).

---

## Conclusão

**O plano descrito na especificação é viável** e foi seguido na implementação. A arquitetura (sessão por aba no service worker + append incremental + persistência em `chrome.storage.session`) é adequada ao Manifest V3 e corrige as causas de perda de histórico descritas no PRD.

Complexidade: **média-alta** (vários pontos de integração, deduplicação, testes de navegação). O PRD divide bem em fases 1–4.

---

## Confirmação do diagnóstico no código (antes da correção)

| Afirmação na spec | Evidência no código |
|-------------------|---------------------|
| Timeline no MAIN world é efémera por documento | `page-bridge.ts`: `state.timeline` vive dentro de `init()` por injeção; nova navegação completa = novo documento = novo script (ou reinício de estado). |
| Content script só tem “último snapshot” | `context-collector.ts`: `latestBridge` é módulo-estático; `onSnap` **substitui** o snapshot com dados do último evento `qa-feedback:snapshot`, com `interactionTimeline` já truncado a `issueTimelineEntries`. |
| Modelo snapshot, não sessão cross-page | `buildCapturedIssueContext` / submit em `FeedbackApp.tsx` usam `readBridgeSnapshot()` no momento do preview/submit — só o que está em memória naquele documento. |
| Limites reduzem histórico | `context-limits.ts`: `bridgeTimelineBuffer`, `issueTimelineEntries`; `page-bridge` faz `cap` na timeline antes de emitir. |

Ou seja: o cenário Reclame AQUI (várias URLs na **mesma aba**) perdia eventos das páginas anteriores porque cada carregamento repõe o bridge e o `latestBridge` do isolated world.

---

## Por que a solução proposta encaixa

1. **Service worker por `tabId`:** O SW já usa `sender.tab?.id` em outros fluxos (`chrome.storage.session` por aba, rede, etc.). Mensagens `QAF_TIMELINE_APPEND` a partir do content script podem omitir `tabId` no payload e usar **`sender.tab.id`** no handler (menos spoofing).

2. **`chrome.storage.session`:** Já existe padrão semelhante em `feedback-ui-session.ts` / chaves `qafTabUiV1_*`. Espelhar a timeline na session storage mitiga **restarts do SW** (MV3).

3. **Append incremental vs substituição:** Cada `emit()` do bridge envia uma fatia da timeline **da página atual**. O SW **concatena e deduplica** (timestamp + `kind|summary` ou hash como na spec), não substitui o store pelo último snapshot.

4. **Submit:** Antes de `buildCapturedIssueContext` (ou dentro dele, com parâmetro opcional), obter `QAF_TIMELINE_GET_FOR_SUBMIT` e **fundir** com a timeline do bridge atual (última página), aplicando depois os limites de **exibição** na issue (`issueTimelineEntries` / modo de captura).

5. **Ciclo de vida:** `QAF_TIMELINE_SESSION_START` ao abrir/engajar o painel; `QAF_TIMELINE_SESSION_END` no fecho ou após submit com sucesso — alinhado ao fluxo de `closeModal` / reset.

---

## Pontos de atenção (além dos riscos já listados no PRD)

- **Eventos de navegação:** Garantir que trocas de URL geram entradas úteis na timeline consolidada (ex.: `navigate` / `section` já existem em tipos — validar se `page-bridge` ou `location-subscription` cobre SPA + reload completo). Pode ser necessário um append explícito de “mudança de URL sanitizada” no content ao detectar `history`/`location`.

- **Duas abas no mesmo site:** Store keyed por `tabId` isola corretamente.

- **Tamanho da issue:** Cap no SW e truncagem final; manter coerência com `capture-mode` (produção sensível).

- **Testes:** Lógica pura de merge/dedupe/TTL em `timeline-session-store.ts` com testes Vitest; handlers no SW com mocks de `chrome.storage.session` onde fizer sentido.

---

## Ordem de implementação (alinhada ao PRD)

1. **Fase 1:** Tipos + store em memória + handlers no SW + persistência session.
2. **Fase 2:** `context-collector`: em cada `onSnap`, delta vs watermark e append; `FeedbackApp` / `buildCapturedIssueContext`: timeline consolidada no submit.
3. **Fase 3:** Dedupe, cap, TTL, testes.
4. **Fase 4:** Rehydrate após restart SW; telemetria opcional.

---

## Onde está no código (referência rápida)

- `extension/src/shared/timeline-session-store.ts` — merge, dedupe, cap, TTL, rehydrate.
- `extension/src/background/timeline-tab-session.ts` — sessão por aba no SW.
- `extension/src/shared/timeline-append-queue.ts` — fila de appends (evitar perda sob carga).
- `extension/src/background/service-worker.ts` — mensagens `QAF_TIMELINE_*`.
- `extension/src/shared/context-collector.ts` — append incremental a partir de snapshots do bridge.
- `extension/src/ui/FeedbackApp.tsx` — `SESSION_START` / `SESSION_END` e leitura da timeline no submit.

Fila de capturas de tela por aba e persistência em `chrome.storage.session` (prints pendentes) é trabalho relacionado à mesma linha (confiabilidade sob navegação), mas é separável da timeline em si.

**Documentação técnica:** [extension/DOCUMENTATION.md](../../extension/DOCUMENTATION.md) (seção *Linha do tempo contínua (mesma aba)* e mensagens `QAF_TIMELINE_*`).
