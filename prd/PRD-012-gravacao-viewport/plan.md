# Plano técnico — Gravação contínua de viewport para evidências de QA

## 1) Objetivo de produto
Adicionar uma captura de vídeo **curta e leve** da sessão de QA para complementar prints, logs e timeline textual, com foco em:

- reproduzir o bug visual/comportamental com mais contexto;
- reduzir ambiguidade no reporte para Jira/GitHub;
- manter controle de privacidade e tamanho de anexo.

> Resultado esperado: o QA consegue iniciar/parar gravação de forma explícita, anexar automaticamente um WebM (curto) na issue e continuar com o fluxo atual sem fricção.

---

## 2) Diagnóstico do código atual (estado real)

### UI e anexos
- Hoje o fluxo de mídia no formulário está focado em **imagens** (selecionar arquivo, colar print, captura de região), com limite de 8 anexos e 8 MB por arquivo.
- A serialização para Jira já aceita anexos genéricos (`fileName`, `mimeType`, `base64`), então **WebM é tecnicamente compatível** no pipeline de upload atual.

### Captura existente
- Já existe captura de tela estática:
  - `chrome.tabs.captureVisibleTab` no service worker;
  - crop de região no content script;
  - anexo no submit do Jira.

### Lacuna
- Não há estado/fluxo de gravação contínua (start/pause/stop), encoder de vídeo, buffer circular, nem UI de gravação.

---

## 3) Diretrizes técnicas (Chrome MV3)

Com base na documentação oficial do Chrome para extensões MV3:

1. Para gravar em segundo plano e sobreviver a navegações, usar combinação:
   - `chrome.tabCapture.getMediaStreamId(...)` no service worker;
   - `chrome.offscreen.createDocument(...)` para criar um documento oculto;
   - `MediaRecorder` no offscreen document para produzir chunks WebM.

2. `offscreen document` é essencial porque service worker não tem DOM/APIs de mídia.

3. O `tabCapture` exige gesto do usuário (ação explícita de iniciar gravação).

4. Em Chrome 116+, `streamId` do `tabCapture` pode ser consumido no offscreen document no fluxo recomendado pelo próprio Chrome.

---

## 4) Decisões de arquitetura recomendadas

## 4.1 Formato de vídeo
- **Primário:** `video/webm;codecs=vp9,opus`.
- **Fallback:** `video/webm;codecs=vp8,opus` → `video/webm`.
- Escolher em runtime com `MediaRecorder.isTypeSupported(...)`.

> GIF não é recomendado como formato primário: pior compressão para UI real e custo CPU maior para gerar com qualidade aceitável.

## 4.2 Modelo de retenção (leve)
Implementar **buffer circular de chunks** para reter apenas os últimos N segundos (ex.: 30–90s):

- `MediaRecorder.start(timeslice=1000)` para chunks de 1s;
- manter fila em memória no offscreen;
- ao exceder janela alvo, descartar chunks antigos;
- no `stop`, consolidar só a janela final.

Vantagens:
- arquivo menor;
- menor risco de capturar dados excessivos;
- reduz consumo de memória.

## 4.3 Integração com fluxo atual
- Reutilizar `jiraImageAttachments` (renome futuro sugerido para `jiraAttachments`, sem urgência).
- Para GitHub:
  - Fase 1: manter como hoje (sem upload de vídeo para GitHub).
  - Fase 2 opcional: usar upload de asset/release ou link externo (S3/GCS interno).

---

## 5) Plano de implementação por fases

## Fase A — Infra mínima de gravação (MVP técnico)

### A1. Manifest e assets de extensão
- Adicionar permissão `tabCapture` em `manifest.dist.json`.
- Declarar `offscreen.html` como recurso do bundle (via Vite build output).

### A2. Novo offscreen document
Criar:
- `extension/src/offscreen/offscreen.html`
- `extension/src/offscreen/offscreen.ts`

Responsabilidades:
- receber `start-recording` / `stop-recording` via `chrome.runtime.onMessage`;
- converter `streamId` em `MediaStream` com `getUserMedia` constraints `chromeMediaSource: "tab"`;
- iniciar `MediaRecorder` com mime negociado;
- manter buffer circular de chunks;
- ao parar, gerar Blob WebM e retornar `{ mimeType, fileName, base64, durationMs, sizeBytes }`.

### A3. Service worker como orquestrador
No `service-worker.ts`:
- mensagem `QAF_VIDEO_RECORDING_START`:
  - valida aba ativa e gesto do usuário;
  - garante existência do offscreen (com `chrome.runtime.getContexts` + `chrome.offscreen.createDocument`);
  - chama `chrome.tabCapture.getMediaStreamId({ targetTabId })`;
  - encaminha streamId ao offscreen.
- mensagem `QAF_VIDEO_RECORDING_STOP`:
  - solicita flush final do offscreen;
  - retorna payload serializado para UI.

## Fase B — UI/UX no FeedbackApp

### B1. Estado de gravação
No `FeedbackApp.tsx`, adicionar estado:
- `idle | recording | stopping | ready | error`;
- `recordingSeconds` (contador);
- `videoAttachment?: JiraImageAttachmentPayload` (tipagem atual permite mime genérico).

### B2. Botões
Substituir/expandir bloco de ações com:
- botão principal: **“Iniciar gravação”** (ícone câmera/check quando ativo);
- durante gravação: **“Parar e anexar”**;
- quando pronto: chip `Vídeo pronto (X MB, Ys)` + remover/regravar.

### B3. Guardrails de UX
- auto-stop em 90s (configurável);
- warning se tamanho final > 8 MB;
- se exceder 8 MB:
  - opção 1 (MVP): bloquear anexo e orientar regravar menor;
  - opção 2 (fase seguinte): re-encode com bitrate menor (mais complexo).

## Fase C — Submit e compatibilidade

### C1. Submit Jira
No trecho que prepara `jiraImageAttachments`:
- incluir também `videoAttachment` (mime `video/webm`).

### C2. Mensagens e copy
Atualizar hint de anexos:
- “até 8 anexos (imagem ou vídeo WebM), 8 MB cada”.

### C3. Fail-safe
Se upload de vídeo falhar mas issue criar:
- manter warning não-bloqueante (`Jira anexos: ...`) como já ocorre.

## Fase D — Privacidade, segurança e observabilidade

### D1. Consentimento explícito
- nunca iniciar gravação automaticamente;
- exigir ação do QA no botão de gravação.

### D2. Escopo visual
- gravar **somente a aba alvo** (tab capture), não tela inteira do sistema.

### D3. Saneamento e política
- manter mesma política de “produção sensível” para texto técnico;
- adicionar nota de privacidade específica para vídeo nas opções/documentação.

### D4. Telemetria interna (opcional)
- registrar eventos locais de ciclo de gravação (início, stop, erro, size) sem conteúdo do vídeo.

---

## 6) Estratégia de compressão e limites (recomendação objetiva)

Configuração inicial sugerida:
- resolução: a própria da aba (nativa do stream capturado);
- `videoBitsPerSecond`: 600_000 a 1_000_000;
- `audioBitsPerSecond`: 64_000 (opcional; pode desligar áudio no MVP);
- duração máx: 60s (começar conservador);
- alvo de tamanho: 3–6 MB para boa taxa de sucesso no limite de 8 MB.

Se o produto exigir “gravar em segundo plano por mais tempo”, adotar:
- janela deslizante (buffer circular) de 60–120s;
- anexar apenas recorte final relevante.

---

## 7) Riscos e mitigação

1. **Arquivo grande demais**
   - Mitigar com auto-stop curto + bitrate controlado + janela circular.

2. **Permissões / bloqueios em páginas especiais**
   - Exibir erro claro (chrome://, Web Store, etc.) como já feito em captura de tela.

3. **Áudio da aba silenciado ao capturar**
   - Se habilitar áudio, considerar rotear áudio para `AudioContext.destination` conforme docs do `tabCapture`.

4. **Conflitos de estado entre SW e offscreen**
   - Usar FSM simples com `recordingSessionId` e idempotência de start/stop.

---

## 8) Modelo de contrato (proposta)

Mensagens runtime:
- `QAF_VIDEO_RECORDING_START` `{ tabId }`
- `QAF_VIDEO_RECORDING_STARTED` `{ sessionId, startedAt, maxDurationSec }`
- `QAF_VIDEO_RECORDING_STOP` `{ sessionId }`
- `QAF_VIDEO_RECORDING_STOPPED` `{ attachment, durationMs, sizeBytes }`
- `QAF_VIDEO_RECORDING_ERROR` `{ code, message }`

`attachment`:
```ts
{
  fileName: `qa-recording-${Date.now()}.webm`,
  mimeType: "video/webm",
  base64: "..."
}
```

---

## 9) Checklist de rollout

1. Feature flag local `enableViewportRecording` nas opções (default OFF em produção inicial).
2. QA interno em 3 cenários:
   - bug curto UI (<=15s);
   - navegação SPA com bug no final;
   - página com áudio ativo.
3. Validar upload Jira com vídeo WebM real.
4. Medir taxa de falhas por tamanho/permissão.
5. Ativar gradual para times QA.

---

## 10) Próximos passos práticos (ordem sugerida)

1. Criar infraestrutura offscreen + mensagens start/stop no SW.
2. Expor botão “Iniciar gravação / Parar e anexar” no formulário.
3. Anexar WebM no payload do Jira.
4. Ajustar texto da UI + documentação.
5. Rodar testes unitários e smoke manual em Chrome 116+.

---

## 11) Referências oficiais usadas

- Chrome Extensions — Audio recording and screen capture: https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture
- Chrome Extensions API — `chrome.tabCapture`: https://developer.chrome.com/docs/extensions/reference/api/tabCapture
- Chrome Extensions API — `chrome.offscreen`: https://developer.chrome.com/docs/extensions/reference/api/offscreen
- MDN Web Docs — `MediaRecorder`: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
