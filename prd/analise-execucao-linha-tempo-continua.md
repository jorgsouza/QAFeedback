# Análise de execução — linha do tempo contínua (mesma aba, multi-URL)

**Branch:** `feature/analise-linha-tempo-continua`  
**Especificação:** [`linha do tempo contínua.md`](../linha%20do%20tempo%20cont%C3%ADnua.md) (raiz do repositório)  
**Data:** 2026-03-26

---

## Conclusão

**É viável executar o plano descrito no ficheiro de especificação.** A arquitetura proposta (sessão por aba no service worker + append incremental + persistência em `chrome.storage.session`) é adequada ao Manifest V3 e corrige precisamente as causas atuais de perda de histórico.

Complexidade estimada: **média-alta** (vários pontos de integração, deduplicação, testes de navegação). O documento já divide bem em fases 1–4.

---

## Confirmação do diagnóstico no código atual

| Afirmação na spec | Evidência no código |
|-------------------|---------------------|
| Timeline no MAIN world é efémera por documento | `page-bridge.ts`: `state.timeline` vive dentro de `init()` por injeção; nova navegação completa = novo documento = novo script (ou reinício de estado). |
| Content script só tem “último snapshot” | `context-collector.ts`: `latestBridge` é módulo-estático; `onSnap` **substitui** o snapshot com dados do último evento `qa-feedback:snapshot`, com `interactionTimeline` já truncado a `issueTimelineEntries`. |
| Modelo snapshot, não sessão cross-page | `buildCapturedIssueContext` / submit em `FeedbackApp.tsx` usam `readBridgeSnapshot()` no momento do preview/submit — só o que está em memória naquele documento. |
| Limites reduzem histórico | `context-limits.ts`: `bridgeTimelineBuffer`, `issueTimelineEntries`; `page-bridge` faz `cap` na timeline antes de emitir. |

Ou seja: o cenário Reclame AQUI (várias URLs na **mesma aba**) perde eventos das páginas anteriores porque cada carregamento repõe o bridge e o `latestBridge` do isolated world.

---

## Por que a solução proposta encaixa

1. **Service worker por `tabId`:** O SW já usa `sender.tab?.id` noutros fluxos (`chrome.storage.session` por aba, rede, etc.). Mensagens `QAF_TIMELINE_APPEND` a partir do content script podem omitir `tabId` no payload e usar **`sender.tab.id`** no handler (menos spoofing).

2. **`chrome.storage.session`:** Já existe padrão semelhante em `feedback-ui-session.ts` / chaves `qafTabUiV1_*`. Espelhar a timeline na session storage mitiga **restarts do SW** (MV3).

3. **Append incremental vs substituição:** Hoje cada `emit()` do bridge envia uma fatia da timeline **da página atual**. O SW deve **concatenar e deduplicar** (timestamp + `kind|summary` ou hash como na spec), não substituir o store pelo último snapshot.

4. **Submit:** Antes de `buildCapturedIssueContext` (ou dentro dele, com um parâmetro opcional), obter `QAF_TIMELINE_GET_FOR_SUBMIT` e **fundir** com a timeline do bridge atual (última página), aplicando depois os limites de **exibição** na issue (`issueTimelineEntries` / modo de captura).

5. **Ciclo de vida:** `QAF_TIMELINE_SESSION_START` ao abrir/engajar o painel (já existe engate de UI); `QAF_TIMELINE_SESSION_END` no fecho ou após submit com sucesso — alinhado ao fluxo atual de `closeModal` / reset.

---

## Pontos de atenção (além dos riscos já listados na spec)

- **Eventos de navegação:** Garantir que trocas de URL geram entradas úteis na timeline consolidada (ex.: `navigate` / `section` já existem em tipos — validar se `page-bridge` ou `location-subscription` cobre SPA + reload completo). Pode ser necessário um append explícito de “mudança de URL sanitizada” no content ao detectar `history`/`location`.

- **Duas abas no mesmo site:** Store keyed por `tabId` isola corretamente.

- **Tamanho da issue:** A spec já prevê cap no SW e truncagem final; manter coerência com `capture-mode` (produção sensível).

- **Testes:** Vitest no SW é mais incómodo; extrair lógica pura de merge/dedupe/TTL para um módulo testável (ex. `timeline-session-store.ts`) e testar handlers com mocks de `chrome.storage.session`.

---

## Ordem de implementação sugerida (alinhada à spec)

1. **Fase 1:** Tipos + store em memória + handlers no `service-worker.ts` + persistência session (sem ainda alterar submit).
2. **Fase 2:** `context-collector` ou listener dedicado no content: em cada `onSnap`, calcular novos eventos vs último watermark e `sendMessage` append; `FeedbackApp` / `buildCapturedIssueContext`: ler timeline consolidada no submit.
3. **Fase 3:** Dedupe, cap, TTL, testes.
4. **Fase 4:** Rehydrate após restart SW; telemetria opcional.

---

## Próximo passo prático

Implementar a **Fase 1** numa branch de feature derivada desta (ou continuar em `feature/analise-linha-tempo-continua` após merge do doc), com PR pequeno só com store + mensagens + testes unitários do merge.
