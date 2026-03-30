# PRD-012 — Gravação contínua de viewport para evidências de QA

**Status:** Proposto (detalhado para implementação)  
**Owner:** QA Platform / Engenharia de Qualidade  
**Data:** 2026-03-30  
**Idioma:** pt-BR

---

## 1. Contexto e problema

Hoje a extensão QAFeedback já captura evidências importantes (descrição, prints, logs técnicos, timeline e HAR opcional), mas ainda depende de evidência estática para bugs comportamentais, intermitentes ou com transições rápidas.

Isso gera problemas recorrentes:

- dificuldade de reproduzir bugs visuais/animados;
- tickets com contexto parcial (antes/depois sem “durante”);
- maior retrabalho entre QA, dev e triagem;
- necessidade de múltiplos prints para explicar um fluxo curto.

### Situação atual no produto

- O formulário suporta anexos de imagem com limites de quantidade/tamanho.
- A captura “Capturar tela” existe para região/viewport em PNG.
- O pipeline de upload para Jira aceita anexos serializados em base64 com `mimeType` (não limitado a imagem no contrato).
- Não existe gravação de vídeo contínua (start/stop) nem buffer de retenção curta.

---

## 2. Objetivo do PRD

Adicionar gravação de viewport com foco em **evidência curta, leve e acionável**, sem quebrar o fluxo atual.

### Objetivos principais

1. Permitir ao QA iniciar/parar gravação da aba em teste dentro do formulário.
2. Anexar automaticamente um vídeo WebM curto junto da issue no Jira.
3. Manter controle de privacidade e tamanho com retenção limitada.
4. Reaproveitar arquitetura atual da extensão MV3 (service worker + content UI + pipeline de anexos).

### Não objetivos (nesta fase)

- gravação de tela inteira do sistema operacional;
- edição de vídeo (trim manual, blur, anotação);
- transcodificação para MP4 no cliente;
- upload de vídeo para GitHub como fluxo oficial (pode entrar em fase futura).

---

## 3. Personas e cenários

## Persona principal

**QA analista funcional** que reporta bugs em aplicações SPA/web com Jira como destino principal.

## Cenários críticos

1. **Bug visual intermitente:** loader travado, layout quebrando e voltando.
2. **Bug de fluxo curto:** clique em botão resulta em estado errado por poucos segundos.
3. **Bug com navegação SPA:** problema só aparece após sequência de passos.

---

## 4. Proposta de produto (UX)

## 4.1 Componente de gravação no formulário

Adicionar ao bloco de anexos:

- botão `Iniciar gravação` (estado inicial);
- estado ativo com indicador visual (`REC`, cronômetro, pulso);
- botão `Parar e anexar`;
- estado pós-gravação com chip: `Vídeo pronto (Xs, Y MB)`;
- ações secundárias: `Remover` e `Gravar novamente`.

## 4.2 Regras de UX

- gravação só inicia por ação explícita do usuário;
- auto-stop ao atingir tempo máximo (ex.: 60s inicial);
- exibir mensagem clara em erros (permissão, página restrita, falha de captura);
- manter botão desabilitado quando estiver no limite de anexos.

## 4.3 Cópia e orientação no formulário

Atualizar hint de anexos para refletir vídeo:

> “Até 8 anexos (imagem ou vídeo WebM), 8 MB cada.”

---

## 5. Requisitos funcionais

## RF-01 — Iniciar gravação
Ao clicar em `Iniciar gravação`, a extensão deve iniciar captura da aba atual com sessão de gravação identificável.

## RF-02 — Parar gravação
Ao clicar em `Parar e anexar` (ou auto-stop), a extensão deve gerar um arquivo WebM e anexá-lo ao estado local do formulário.

## RF-03 — Regravar e remover
Usuário pode remover o vídeo atual e iniciar nova gravação.

## RF-04 — Envio para Jira
Se Jira estiver marcado, o vídeo deve ser enviado via pipeline de anexos já existente após criação da issue.

## RF-05 — Robustez de erro
Falhas de vídeo não devem impedir, por padrão, a criação da issue textual/imagens (erro de anexo é warning não bloqueante).

## RF-06 — Limites
A UX deve aplicar limite de duração e informar quando arquivo exceder política de tamanho.

---

## 6. Requisitos não funcionais

## RNF-01 — Performance
- impacto mínimo perceptível no uso normal da página;
- gravação com bitrate controlado para evitar arquivos grandes.

## RNF-02 — Privacidade
- sem gravação automática;
- escopo restrito à aba alvo;
- documentação explícita do comportamento.

## RNF-03 — Compatibilidade
- Chrome MV3 (baseline interno: Chrome 116+);
- fallback de codec quando `vp9` indisponível.

## RNF-04 — Confiabilidade
- fluxo tolerante a reinício do service worker durante sessão;
- estado de gravação consistente para evitar “sessões órfãs”.

---

## 7. Arquitetura técnica proposta

## 7.1 Padrão MV3 recomendado

- **Service worker**: orquestra start/stop e sessão.
- **Offscreen document**: executa captura/MediaRecorder (DOM APIs).
- **UI (FeedbackApp)**: controles e feedback de estado.

## 7.2 APIs alvo

- `chrome.tabCapture.getMediaStreamId(...)`
- `chrome.offscreen.createDocument(...)`
- `MediaRecorder` no offscreen document

## 7.3 Formato de mídia

- Primário: `video/webm;codecs=vp9,opus`
- Fallback: `video/webm;codecs=vp8,opus`
- Fallback final: `video/webm`

## 7.4 Estratégia de retenção

**Buffer circular por chunks (timeslice 1s)** com janela curta (60–90s):

- evita crescimento indefinido de memória;
- melhora chance de caber no limite de anexo;
- preserva trecho mais recente da sessão de QA.

---

## 8. Contrato de mensagens (proposta)

### Runtime messages

- `QAF_VIDEO_RECORDING_START` `{ tabId }`
- `QAF_VIDEO_RECORDING_STOP` `{ sessionId }`
- `QAF_VIDEO_RECORDING_STATUS` `{ sessionId }`

### Respostas

- `QAF_VIDEO_RECORDING_STARTED` `{ sessionId, startedAt, maxDurationSec }`
- `QAF_VIDEO_RECORDING_STOPPED` `{ attachment, durationMs, sizeBytes }`
- `QAF_VIDEO_RECORDING_ERROR` `{ code, message }`

### Payload de anexo

```ts
{
  fileName: "qa-recording-<timestamp>.webm",
  mimeType: "video/webm",
  base64: "..."
}
```

---

## 9. Segurança e privacidade

1. **Consentimento explícito:** gravação somente via botão do usuário.
2. **Escopo:** apenas aba ativa alvo (não desktop inteiro).
3. **Minimização:** duração limitada e buffer circular.
4. **Transparência:** texto na UI e documentação sobre o que é gravado.
5. **Produção sensível:** manter política atual para texto técnico; vídeo segue regra de consentimento e limite.

---

## 10. Limites e políticas iniciais

- Duração máxima padrão: **60s**
- Alvo de tamanho: **3–6 MB**
- Limite hard por anexo: **8 MB**
- Quantidade total de anexos (já existente): **8**

### Comportamento em overflow

- Se vídeo > 8 MB: não anexar automaticamente e orientar regravação menor.
- Fase futura opcional: re-encode com bitrate mais baixo.

---

## 11. Critérios de aceite

## CA-01
QA consegue iniciar/parar gravação no formulário e visualizar status claro.

## CA-02
Ao parar, vídeo WebM aparece como anexo pronto para envio no fluxo Jira.

## CA-03
Se upload de vídeo falhar, issue ainda pode ser criada com warning explícito.

## CA-04
Tempo máximo e limites são respeitados; UX informa quando excede tamanho.

## CA-05
Gravação não inicia automaticamente em nenhum cenário.

---

## 12. Plano de implementação por fases

## Fase 1 — Infra técnica (MVP)

- adicionar permissão `tabCapture` no manifest;
- criar `offscreen.html` + `offscreen.ts`;
- implementar mensagens start/stop no service worker;
- gerar attachment base64 WebM.

## Fase 2 — UI e integração

- controles no `FeedbackApp`;
- estados de gravação e cronômetro;
- integrar anexo de vídeo no payload de envio Jira;
- atualizar textos de ajuda no formulário.

## Fase 3 — Hardening

- auto-stop configurável;
- tratamento robusto de erros/permissões;
- validação de tamanho e mensagens refinadas.

## Fase 4 — Rollout gradual

- feature flag;
- QA interno em cenários críticos;
- habilitação progressiva por time.

---

## 13. Métricas de sucesso

- % de issues com vídeo anexo (adoção);
- redução de tempo médio de triagem para bugs UI;
- redução de reabertura de tickets por “informação insuficiente”; 
- taxa de falha de anexo por tamanho/permissão.

---

## 14. Riscos e mitigação

1. **Vídeo grande demais**  
   Mitigação: tempo curto + bitrate + buffer circular.

2. **Permissão/ambiente restrito**  
   Mitigação: mensagens claras e fallback para print + logs.

3. **Inconsistência entre SW e offscreen**  
   Mitigação: `sessionId`, máquina de estados simples e idempotência.

4. **Receio de privacidade**  
   Mitigação: consentimento explícito, escopo de aba, copy transparente.

---

## 15. Dependências

- ajustes no build para incluir offscreen document;
- revisão de cópia UX no formulário;
- validação funcional em Chrome estável;
- alinhamento com política interna de evidência de QA.

---

## 16. Open questions

1. Gravação deve incluir áudio por padrão ou ser opt-in?
2. Para GitHub, manter sem vídeo inicialmente ou oferecer link externo?
3. Limite padrão ideal: 45s, 60s ou 90s para melhor equilíbrio?
4. Exibir preview inline do vídeo no modal ou apenas metadados?

---

## 17. Referências oficiais

- Chrome Extensions — Audio recording and screen capture: https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture
- Chrome Extensions API — `chrome.tabCapture`: https://developer.chrome.com/docs/extensions/reference/api/tabCapture
- Chrome Extensions API — `chrome.offscreen`: https://developer.chrome.com/docs/extensions/reference/api/offscreen
- MDN — `MediaRecorder`: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
