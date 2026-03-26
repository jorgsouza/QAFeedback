# PRD-010 — Linha do tempo contínua na mesma aba (multi-URL)

> **Índice:** [`prd/INDEX.md`](../INDEX.md)  
> **Data:** 2026-03-26  
> **Análise de viabilidade:** [analise-execucao.md](analise-execucao.md)

## Diagnóstico técnico — perda de timeline ao navegar em múltiplas URLs na MESMA aba

### Requisito corrigido (escopo)

**Não é para rastrear troca de abas do navegador.**

O requisito é manter uma **linha do tempo contínua na mesma aba** enquanto o QA percorre várias URLs, por exemplo:

1. `https://www.reclameaqui.com.br/`
2. `https://www.reclameaqui.com.br/detector-site-confiavel/`
3. voltar para `https://www.reclameaqui.com.br/`
4. buscar empresa e abrir `https://www.reclameaqui.com.br/empresa/ripio/`
5. abrir `https://www.reclameaqui.com.br/reclamar/157104/`

Tudo isso deve aparecer no histórico enviado na abertura do chamado.

---

### Por que hoje falha nesse cenário

#### 1) Estado de timeline é efêmero por documento

No `page-bridge` (MAIN world), a timeline está em `state.timeline` (memória local da página). Em navegação completa, o documento muda e esse estado é perdido.

#### 2) O content script só mantém “último snapshot” em memória

`latestBridge` no `context-collector` também é memória local. Em reload/reinjeção, reinicia.

#### 3) O fluxo atual é snapshot-oriented, não event-sourcing cross-page

Hoje o modelo favorece “estado atual da página” e não uma sessão contínua da aba ao longo de várias navegações completas.

#### 4) Limites de retenção reduzem histórico em sessões longas

Mesmo sem reload, `issueTimelineEntries` e `bridgeTimelineBuffer` podem truncar eventos antigos.

---

### Estratégia correta de correção (focada em mesma aba)

### Objetivo técnico

Criar uma **sessão de timeline por `tabId`** no service worker, que sobreviva a mudanças de URL na mesma aba e seja usada no envio do chamado.

### Arquitetura proposta

#### A. Event stream incremental (content -> service worker)

- Adicionar mensagem de runtime, ex.: `QAF_TIMELINE_APPEND`.
- Payload mínimo:
  - `tabId`
  - `sessionId` (uuid iniciado ao abrir o painel)
  - `event: { at, kind, summary, pageUrlSanitized, pathname }`
- Sempre que o `page-bridge` emitir snapshot, o content script calcula o delta e envia só eventos novos para o SW.

#### B. Store de sessão no service worker

- Estrutura em memória (e espelho em `chrome.storage.session`):

```ts
type TimelineSessionStore = {
  [tabId: number]: {
    sessionId: string;
    startedAt: string;
    updatedAt: string;
    entries: InteractionTimelineEntryV1[]; // cap + TTL
  }
}
```

- Regras:
  - merge incremental por timestamp + hash simples (`kind|summary|atRounded`)
  - cap de segurança (ex.: 400 eventos por sessão)
  - TTL (ex.: 2 horas sem atividade => expira)

#### C. Recuperação no momento de criar issue

- Na ação de submit (`CREATE_ISSUE`), UI/content solicita ao SW:
  - `QAF_TIMELINE_GET_FOR_SUBMIT { tabId, sessionId }`
- O builder passa a usar **timeline consolidada do SW** (não apenas `latestBridge.interactionTimeline`).

#### D. Ciclo de vida da sessão

- Ao abrir painel de feedback na aba: iniciar/reatar sessão (`QAF_TIMELINE_SESSION_START`).
- Ao enviar issue com sucesso ou fechar fluxo explicitamente: `QAF_TIMELINE_SESSION_END`.
- Se recarregar página no meio: mesma sessão continua (porque está no SW por `tabId + sessionId`).

---

### Ajustes de implementação por arquivo

#### 1) `extension/src/background/service-worker.ts`

Adicionar handlers:

- `QAF_TIMELINE_SESSION_START`
- `QAF_TIMELINE_APPEND`
- `QAF_TIMELINE_GET_FOR_SUBMIT`
- `QAF_TIMELINE_SESSION_END`

Implementar store em memória + persistência best-effort em `chrome.storage.session`.

#### 2) `extension/src/shared/context-collector.ts`

- Manter bridge atual para coletar sinais da página.
- Adicionar lógica para detectar eventos novos e enviar incrementalmente ao SW (append).
- Não depender apenas de `latestBridge` para o submit final.

#### 3) `extension/src/ui/FeedbackApp.tsx` (ou ponto de submit)

- Antes de montar payload final de issue:
  1. pedir timeline consolidada ao SW;
  2. aplicar sanitização e limites finais de exibição;
  3. anexar em `technicalContext.interactionTimeline`.

#### 4) `extension/src/shared/context-limits.ts`

- Revisar limites para sessão cross-url:
  - `issueTimelineEntries` (exibição final)
  - novo limite de store no SW (`swTimelineSessionMaxEntries`)
  - novo TTL (`swTimelineSessionTtlMs`)

---

### Critérios de aceite (exatamente o caso pedido)

Dado uma única aba:

1. abrir `/`
2. ir para `/detector-site-confiavel/`
3. voltar para `/`
4. ir para `/empresa/ripio/`
5. ir para `/reclamar/157104/`
6. abrir e enviar feedback

Resultado esperado:

- timeline enviada contém eventos de navegação/interação de **todo o fluxo** (ordem cronológica coerente);
- eventos dos passos iniciais continuam presentes no submit final;
- não depende de manter a mesma página sem reload.

---

### Plano de execução (curto)

#### Fase 1 (base)

- Criar mensagens e store no SW.
- Iniciar sessão por aba ao engajar UI.

#### Fase 2 (integração)

- Content script envia append incremental de timeline.
- Submit passa a ler timeline consolidada do SW.

#### Fase 3 (qualidade)

- Deduplicação robusta + cap + TTL.
- Testes unitários e integração para navegação multi-URL na mesma aba.

#### Fase 4 (hardening)

- Telemetria debug (contagem de eventos por sessão).
- Fallback seguro quando SW reiniciar (rehydrate de `chrome.storage.session`).

---

### Riscos e mitigação

- **SW dorme/reinicia (MV3):** mitigar com espelho em `chrome.storage.session`.
- **Explosão de eventos:** cap + throttling já existente + dedupe no append.
- **Payload grande na issue:** manter limite de exibição final e resumir quando exceder.
