/** Estilos isolados no Shadow DOM (evita conflito com a página). */
export const shadowCss = `
:host {
  all: initial;
  font-family: "Inter Tight", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: #0f172b;
  color-scheme: light;
}

*, *::before, *::after { box-sizing: border-box; }

/* Camada full-viewport: o host do shadow costuma ter tamanho 0; isto garante hit-testing nos FABs e no modal. */
.qaf-portal-root {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 2147483646;
  isolation: isolate;
}

.qaf-portal-root .qaf-wrap,
.qaf-portal-root .qaf-backdrop,
.qaf-portal-root .qaf-modal {
  pointer-events: auto;
}

.qaf-portal-root .qaf-wrap {
  z-index: 1;
}

.qaf-portal-root .qaf-backdrop {
  z-index: 2;
}

.qaf-portal-root .qaf-modal {
  z-index: 3;
}

.qaf-wrap {
  position: fixed;
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none;
}

.qaf-wrap > * {
  pointer-events: auto;
}

.qaf-fab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  padding: 10px 18px 10px 14px;
  background: rgba(15, 23, 42, 0.94);
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.02em;
  cursor: pointer;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(0, 0, 0, 0.15) inset;
  backdrop-filter: saturate(140%) blur(12px);
  -webkit-backdrop-filter: saturate(140%) blur(12px);
  transition: background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.qaf-fab-icon-only {
  width: 64px;
  height: 64px;
  padding: 0;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  /* Só o mascote (PNG 64×64); sem halo nem fundo extra */
  background: transparent;
  border: none;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.qaf-fab-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border-radius: 50%;
  overflow: hidden;
  width: 100%;
  height: 100%;
}

.qaf-fab-icon-wrap img {
  width: 40px;
  height: 40px;
  max-width: 40px;
  max-height: 40px;
  object-fit: contain;
  display: block;
  pointer-events: none;
}

/* Imagem 64×64 a preencher todo o FAB (Figma); sem drop-shadow (evita “anel” cinza/azul). */
.qaf-fab-icon-only .qaf-fab-icon-wrap img {
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  object-fit: cover;
  border-radius: 50%;
  display: block;
}

.qaf-fab-fallback {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.03em;
  line-height: 1;
}

.qaf-fab-icon-only .qaf-fab-fallback {
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.qaf-fab:hover {
  background: rgba(30, 41, 59, 0.98);
  transform: translateY(-2px);
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.42);
}

.qaf-fab-icon-only:hover {
  background: transparent;
  box-shadow: none;
  transform: translateY(-2px) scale(1.03);
}

.qaf-fab:active {
  transform: translateY(0);
}

.qaf-fab-icon-only:active {
  transform: translateY(0) scale(0.97);
}

.qaf-fab-icon-only.qaf-fab--integrations-loading {
  position: relative;
}

.qaf-fab-icon-only.qaf-fab--recording {
  position: relative;
}

.qaf-fab-rec-pill {
  position: absolute;
  right: -4px;
  bottom: -4px;
  min-width: 28px;
  padding: 3px 6px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #fff;
  background: #dc2626;
  border-radius: 8px;
  line-height: 1.2;
  pointer-events: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}

.qaf-fab-icon-only.qaf-fab--integrations-loading::after {
  content: "";
  position: absolute;
  inset: 2px;
  border-radius: 50%;
  border: 2px solid rgba(0, 77, 55, 0.2);
  border-top-color: var(--qaf-m-primary);
  animation: qaf-fab-spin 0.65s linear infinite;
  box-sizing: border-box;
  pointer-events: none;
}

@keyframes qaf-fab-spin {
  to {
    transform: rotate(360deg);
  }
}

.qaf-fab-cluster {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
  position: relative;
  z-index: 0;
}

.qaf-fab-dismiss {
  position: relative;
  z-index: 2;
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.55);
  color: #fff;
  font-size: 18px;
  line-height: 1;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  transition: background 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.qaf-fab-dismiss:hover {
  background: rgba(127, 29, 29, 0.92);
  border-color: rgba(255, 255, 255, 0.5);
}

.qaf-fab-dismiss:active {
  transform: scale(0.94);
}

.qaf-link {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
}

.qaf-link:hover {
  color: #fff;
}

.qaf-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
}

.qaf-backdrop--sheet {
  background: rgba(0, 0, 0, 0.5);
}

.qaf-modal {
  /* Tema alinhado ao Figma «QA Automation — plugin» (superfície clara) */
  --qaf-m-bg: #ffffff;
  --qaf-m-surface: #f8fafc;
  --qaf-m-border: #e2e8f0;
  --qaf-m-text: #0f172b;
  --qaf-m-muted: #62748e;
  /* Rota (path) na faixa de estado — mais forte que o slug, sem chegar ao texto principal */
  --qaf-route-path-strong: #3d4e64;
  --qaf-m-input: #ffffff;
  --qaf-m-input-border: #cad5e2;
  --qaf-m-placeholder: #94a3b8;
  --qaf-m-primary: #004d37;
  --qaf-m-on-primary: #f8fafc;

  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(420px, calc(100vw - 32px));
  max-height: min(90vh, 867px);
  background: var(--qaf-m-bg);
  color: var(--qaf-m-text);
  border: 1px solid var(--qaf-m-border);
  border-radius: 12px;
  box-shadow: 0 24px 48px rgba(15, 23, 43, 0.12), 0 2px 2px rgba(98, 116, 142, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Largura do frame _SheetContent no Figma QA Automation — plugin (≈454px). */
.qaf-modal--dock {
  left: auto;
  right: 0;
  top: max(12px, 5vh);
  bottom: max(12px, 5vh);
  transform: none;
  width: min(454px, calc(100vw - 20px));
  max-height: min(90vh, 867px);
  border-radius: 12px 0 0 12px;
  border: none;
  border-left: 1px solid #e2e8f0;
  box-shadow:
    0 4px 6px -2px rgba(98, 116, 142, 0.08),
    0 10px 16px -3px rgba(98, 116, 142, 0.12);
}

/* Sheet Figma 11:5116: padding 24; sem separador pesado entre cabeçalho e corpo. */
.qaf-modal-header {
  padding: 24px 24px 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border-bottom: none;
}

.qaf-modal-header-brand {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.qaf-modal-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: transparent;
  border: none;
}

.qaf-modal-avatar img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 50%;
  display: block;
}

.qaf-modal-header-text {
  flex: 1;
  min-width: 0;
}

/* SheetHeader — text-lg/semibold (Figma body_dialog). */
.qaf-modal-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 28px;
  letter-spacing: 0.043em;
  color: #0f172b;
}

/* Typography/description tertiary */
.qaf-modal-subtitle {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: 0.043em;
  color: #62748e;
}

.qaf-modal-subtitle-note {
  display: block;
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 500;
  color: #62748e;
}

.qaf-modal-settings-link {
  display: inline-block;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  font-size: 12px;
  font-weight: 500;
  color: var(--qaf-m-muted);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.qaf-modal-settings-link:hover {
  color: var(--qaf-m-text);
}

.qaf-modal-header-actions {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-shrink: 0;
}

.qaf-modal-icon-btn {
  width: 36px;
  height: 36px;
  margin: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--qaf-m-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}

.qaf-modal-icon-btn:hover {
  background: #f1f5f9;
  color: var(--qaf-m-text);
}

.qaf-modal-close {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  margin: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--qaf-m-muted);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}

.qaf-modal-close:hover {
  background: #f1f5f9;
  color: var(--qaf-m-text);
}

.qaf-repo-bar {
  padding: 16px 24px 0;
  margin-bottom: 0;
  border-bottom: none;
}

.qaf-repo-bar.qaf-field {
  margin-bottom: 0;
}

.qaf-tabs {
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  margin-top: 16px;
  padding: 0 24px;
  background: var(--qaf-m-bg);
}

/* Tabs estilo Trust / Figma: inativo slate, ativo primary-700 + indicador. */
.qaf-tab {
  flex: 1;
  border: none;
  background: transparent;
  padding: 12px 8px 10px;
  cursor: pointer;
  font-weight: 500;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0.043em;
  color: #62748e;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.qaf-tab:hover {
  color: #0f172b;
}

.qaf-tab-active {
  color: #004d37;
  border-bottom-color: #004d37;
  font-weight: 600;
}

/* body_dialog Figma: gap 20 entre blocos; padding inferior 24; conteúdo alinhado à _SheetContent (24px laterais). */
.qaf-body {
  padding: 16px 24px 24px;
  overflow: auto;
  flex: 1;
  background: #ffffff;
}

/* Estado «Evidência criada» — Figma node 5:16262 / _SheetContent: gap 16 após header. */
.qaf-body--post-submit {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 16px 24px 24px;
}

.qaf-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 20px;
}

/* text-sm/medium — labels Select / campos (0,6px ≈ 0,043em a 14px). */
.qaf-label {
  font-weight: 500;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0.043em;
  color: #0f172b;
}

/* Label + chips: gap 14px no Figma (layout_66AZMO). */
.qaf-field--motivo-abertura {
  gap: 14px;
}

.qaf-required { color: #f87171; }

.qaf-input, .qaf-textarea, .qaf-select {
  width: 100%;
  border: 1px solid #cad5e2;
  border-radius: 12px;
  padding: 8px 12px;
  font: inherit;
  background: #ffffff;
  color: #0f172b;
}

/* _SelectTrigger / inputs: altura 48px (Figma). */
.qaf-input,
.qaf-select {
  min-height: 48px;
  line-height: 20px;
}

.qaf-input--readonly {
  background: var(--qaf-m-surface);
  color: var(--qaf-m-muted);
  cursor: default;
}

.qaf-input::placeholder,
.qaf-textarea::placeholder {
  color: var(--qaf-m-placeholder);
}

.qaf-select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24'%3E%3Cpath fill='%23000000' d='M7 10l5 5 5-5H7z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 40px;
}

.qaf-textarea { min-height: 88px; resize: vertical; }

/* Título / descrição: microfone dentro da caixa (Figma / AIStudio: relative + absolute). */
.qaf-input-with-mic {
  position: relative;
  display: block;
  width: 100%;
}

.qaf-input-with-mic .qaf-input-flex {
  width: 100%;
  min-width: 0;
  padding-right: 42px;
  box-sizing: border-box;
}

/* Bloco Textarea Figma (~161px com label+gap 4): área útil ~137px de altura mínima. */
.qaf-textarea-with-mic {
  position: relative;
  display: block;
  width: 100%;
}

.qaf-textarea-with-mic .qaf-textarea-flex {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 137px;
  padding: 10px 42px 10px 12px;
  box-sizing: border-box;
  resize: vertical;
}

.qaf-dictation-mic-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid #cad5e2;
  background: #ffffff;
  color: #0f172b;
  cursor: pointer;
  box-sizing: border-box;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.qaf-dictation-mic-svg {
  display: block;
  flex-shrink: 0;
}

/* Título: microfone centrado no input 48px; inset para não colidir com a borda arredondada. */
.qaf-dictation-mic-btn--inline {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  z-index: 2;
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
}

/* Descreva o problema: dentro do campo, canto superior direito (abaixo da borda superior). */
.qaf-dictation-mic-btn--textarea {
  position: absolute;
  top: 110px;
  right: 10px;
  bottom: auto;
  z-index: 2;
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  margin: 0;
}

.qaf-dictation-mic-btn:hover {
  background: #f8fafc;
  border-color: #94a3b8;
  color: var(--qaf-m-text);
}

.qaf-dictation-mic-btn:focus-visible {
  outline: 2px solid var(--qaf-m-primary);
  outline-offset: 2px;
}

.qaf-dictation-mic-btn--listening {
  border-color: #c2410c;
  background: rgba(234, 88, 12, 0.12);
  color: #c2410c;
  box-shadow: 0 0 0 1px rgba(234, 88, 12, 0.35);
}

.qaf-dictation-mic-btn--listening:hover {
  background: rgba(234, 88, 12, 0.18);
  border-color: #ea580c;
  color: #9a3412;
}

.qaf-speech-notice {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.45;
}

.qaf-speech-notice--error {
  border: 1px solid rgba(248, 113, 113, 0.45);
  background: rgba(127, 29, 29, 0.35);
  color: #fecaca;
}

.qaf-speech-live {
  margin: -4px 0 12px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--qaf-m-text);
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

.qaf-img-field {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.qaf-img-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.qaf-img-btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  width: 100%;
  align-items: center;
}

.qaf-btn-ghost {
  border: 1px solid #cad5e2;
  background: #ffffff;
  color: #0f172b;
  padding: 8px 12px;
  border-radius: 12px;
  font: inherit;
  font-weight: 500;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0.043em;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.qaf-btn-ghost:hover {
  background: #f8fafc;
}

/* «Selecionar imagem»: contorno tracejado (Figma stroke_K4U0RO). */
.qaf-btn-ghost--dashed {
  border-style: dashed;
  border-width: 1px;
  flex: 1;
  min-height: 48px;
  padding: 8px 16px;
  font-weight: 500;
}

.qaf-img-btn-row .qaf-btn-ghost:not(.qaf-btn-ghost--dashed) {
  flex: 1;
  min-height: 48px;
  padding: 8px 16px;
  font-weight: 500;
}

.qaf-btn-ghost:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.qaf-img-hint {
  font-size: 12px;
  color: var(--qaf-m-muted);
  margin: 0;
  line-height: 1.4;
}

.qaf-img-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.qaf-img-thumb-wrap {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--qaf-m-border);
  flex-shrink: 0;
}

.qaf-img-thumb-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.qaf-img-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qaf-img-remove:hover {
  background: rgba(220, 38, 38, 0.9);
}

.qaf-dest-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.qaf-dest-row .qaf-label {
  margin-bottom: 0;
}

.qaf-dest-segment {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  border-radius: 10px;
  border: 1px solid var(--qaf-m-border);
  overflow: hidden;
  width: 100%;
  max-width: 100%;
}

.qaf-dest-seg-btn {
  flex: 1;
  min-width: 0;
  border: none;
  background: var(--qaf-m-surface);
  color: var(--qaf-m-muted);
  padding: 10px 12px;
  font: inherit;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  border-right: 1px solid var(--qaf-m-border);
}

.qaf-dest-segment .qaf-dest-seg-btn:last-child {
  border-right: none;
}

.qaf-dest-seg-btn:hover {
  color: var(--qaf-m-text);
  background: #f1f5f9;
}

.qaf-dest-seg-btn-active {
  background: #ffffff;
  color: var(--qaf-m-primary);
  box-shadow: 0 0 0 1px var(--qaf-m-border) inset;
}

.qaf-status-strip {
  margin: 0 0 16px;
  width: 100%;
  min-width: 0;
}

.qaf-status-strip-inner {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  min-width: 0;
}

.qaf-status-strip-row--top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-width: 0;
}

.qaf-route-slug {
  font-size: 12px;
  line-height: 1.3;
  color: var(--qaf-m-muted);
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qaf-route-path-line {
  font-size: 12px;
  line-height: 1.35;
  color: var(--qaf-route-path-strong);
  word-break: break-word;
  overflow-wrap: anywhere;
  max-width: 100%;
}

.qaf-status-badges {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  justify-content: flex-end;
  flex-shrink: 0;
  list-style: none;
  margin: 0;
  padding: 0;
}

.qaf-status-badge {
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 4px;
  letter-spacing: 0.02em;
}

.qaf-status-badge--on {
  color: var(--qaf-m-primary);
  background: rgba(0, 77, 55, 0.08);
  box-shadow: 0 0 0 1px rgba(0, 77, 55, 0.22) inset;
}

.qaf-status-badge--off {
  color: var(--qaf-m-placeholder);
  background: var(--qaf-m-surface);
  box-shadow: 0 0 0 1px var(--qaf-m-border) inset;
}

.qaf-status-badge--caution {
  color: #92400e;
  background: rgba(245, 158, 11, 0.14);
  box-shadow: 0 0 0 1px rgba(217, 119, 6, 0.35) inset;
}

.qaf-status-badge--info {
  color: #1e40af;
  background: rgba(59, 130, 246, 0.12);
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.28) inset;
}

.qaf-integrations-loading {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 13px;
  color: var(--qaf-m-text);
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid rgba(59, 130, 246, 0.35);
  background: rgba(239, 246, 255, 0.85);
  margin-bottom: 16px;
  line-height: 1.5;
}

.qaf-integrations-loading__spinner {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  border-radius: 50%;
  border: 2px solid rgba(37, 99, 235, 0.25);
  border-top-color: #2563eb;
  animation: qaf-fab-spin 0.65s linear infinite;
  box-sizing: border-box;
}

.qaf-config-missing {
  font-size: 13px;
  color: var(--qaf-m-text);
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid rgba(248, 113, 113, 0.45);
  background: rgba(127, 29, 29, 0.25);
  margin-bottom: 16px;
  line-height: 1.5;
}

.qaf-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 4px 0 20px;
  font-size: 13px;
  color: var(--qaf-m-text);
  cursor: pointer;
}

.qaf-check input[type="checkbox"] {
  margin-top: 2px;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  accent-color: var(--qaf-m-primary);
  cursor: pointer;
}

.qaf-check-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  line-height: 1.4;
}

.qaf-check-title {
  font-weight: 500;
}

.qaf-check-hint {
  font-size: 12px;
  color: var(--qaf-m-muted);
  font-weight: 400;
}

.qaf-actions-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  padding-top: 18px;
  border-top: 1px solid var(--qaf-m-border);
}

.qaf-success-actions {
  margin-top: 16px;
  padding-top: 16px;
}

.qaf-actions-left {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.qaf-actions-right {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-left: auto;
}

.qaf-btn {
  border-radius: 8px;
  padding: 9px 16px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}

.qaf-btn-submit {
  border: none;
  background: #004d37;
  color: #f8fafc;
}

.qaf-btn-submit:hover:not(:disabled) {
  filter: brightness(1.06);
}

.qaf-btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.qaf-btn-secondary {
  border: 1px solid #cad5e2;
  background: #ffffff;
  color: #0f172b;
  font-weight: 500;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0.043em;
}

.qaf-btn-secondary:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}

.qaf-btn-text {
  border: none;
  background: transparent;
  color: var(--qaf-m-muted);
  padding-left: 0;
  padding-right: 8px;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.qaf-btn-text:hover {
  color: var(--qaf-m-text);
}

.qaf-btn-primary { background: var(--qaf-m-primary); color: var(--qaf-m-on-primary); border: none; }
.qaf-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.qaf-preview {
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.5;
  background: var(--qaf-m-surface);
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px;
  max-height: 360px;
  overflow: auto;
  color: #334155;
}

.qaf-network-diag {
  font-size: 12px;
  line-height: 1.5;
  border-radius: 8px;
  padding: 10px 12px;
  margin: 0 0 14px;
}

.qaf-network-diag strong {
  font-weight: 600;
}

.qaf-network-diag--error {
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.qaf-network-diag--error strong {
  color: #7f1d1d;
}

.qaf-error {
  background: rgba(127, 29, 29, 0.35);
  color: #fecaca;
  border: 1px solid rgba(248, 113, 113, 0.35);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 14px;
  font-size: 13px;
}

.qaf-error .qaf-link {
  color: #fca5a5;
  text-shadow: none;
}

.qaf-error .qaf-link:hover {
  color: #fff;
}

.qaf-error-warn {
  background: rgba(120, 53, 15, 0.45);
  color: #fde68a;
  border: 1px solid rgba(251, 191, 36, 0.45);
}

.qaf-success {
  /* check_positivo: cículo ~80px; verde sucesso alinhado a Trust secondary-600 / nota Figma #63991D */
  --qaf-success-ring: #b6d06f;
  --qaf-success-fill: #e2edc5;
  --qaf-success-icon: #407d18;

  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 20px;
  flex: 1;
  min-height: 0;
  background: transparent;
  color: var(--qaf-m-text);
  border: none;
  border-radius: 0;
  padding: 0;
  margin: 0;
  font-size: 14px;
}

/* body_sucess Figma: coluna centrada, padding vertical 32/24, gap 20 — aqui o bloco hero concentra check+título+meta */
.qaf-success-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 20px;
  width: 100%;
  padding: 16px 0 0;
  flex-shrink: 0;
}

.qaf-success-check {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--qaf-success-fill);
  box-shadow: 0 0 0 1px var(--qaf-success-ring) inset;
  color: var(--qaf-success-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Ilustração {DS} check_positivo (Figma Ilustração 2060:140) — SVG com arte embutida. */
.qaf-success-check--illustration {
  background: transparent;
  box-shadow: none;
  border-radius: 0;
}

.qaf-success-check-img {
  width: 80px;
  height: 80px;
  object-fit: contain;
  display: block;
}

.qaf-success-check svg {
  display: block;
}

/* Ícones 24×24 exportados do {DS}-Icons (Figma). */
.qaf-ds-icon-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  display: block;
}

/* Typography/title secondary — Evidência criada */
.qaf-success-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 32px;
  letter-spacing: 0.025em;
  color: #000000;
}

.qaf-success-board-meta {
  margin: 0;
  max-width: 100%;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: 0.025em;
  color: #62748e;
}

.qaf-success-board-meta strong {
  font-weight: 700;
  color: #0f172b;
}

.qaf-success-board-meta-warn {
  color: #b45309;
  font-weight: 600;
}

.qaf-success-cards {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  flex-shrink: 0;
}

/* Card Figma: row, space-between, padding 24×22, border #E2E8F0, radius 12 */
.qaf-success-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 24px 22px;
  background: #ffffff;
  box-sizing: border-box;
}

.qaf-success-card-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.qaf-success-card-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  margin: 0;
  min-width: 0;
}

.qaf-success-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  color: #000000;
}

.qaf-success-card-label {
  font-weight: 700;
  font-size: 16px;
  line-height: 24px;
  letter-spacing: 0.025em;
  color: #000000;
}

.qaf-success-card-actions {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
}

.qaf-success-card-actions a.qaf-btn {
  text-decoration: none;
  box-sizing: border-box;
}

/* «Acessar»: primário #004D37 (Trust primary-700) sobre secondary outline — paridade com print / marca. */
.qaf-btn-access {
  border: 1px solid #cad5e2;
  background: #ffffff;
  color: var(--qaf-m-primary);
  font-weight: 500;
}

.qaf-btn-access:hover {
  background: #f0fdf4;
  border-color: #86efac;
  color: var(--qaf-m-primary);
}

.qaf-btn-sm {
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  letter-spacing: 0.025em;
  border-radius: 8px;
  min-height: 32px;
  box-sizing: border-box;
}

.qaf-success-card-actions .qaf-btn-secondary {
  border: 1px solid #cad5e2;
  background: #ffffff;
  color: #0f172b;
  font-weight: 500;
}

.qaf-success-card-actions .qaf-btn-secondary:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}

.qaf-success-card-actions .qaf-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.qaf-footer-eq {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
}

.qaf-success-footer {
  margin-top: auto;
  flex-shrink: 0;
}

.qaf-footer-eq-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  width: 100%;
}

.qaf-footer-eq-row--stack {
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}

.qaf-footer-eq-row .qaf-btn {
  flex: 1;
  justify-content: center;
  border-radius: 12px;
  min-height: 48px;
  padding: 8px 16px;
  font-weight: 500;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0.043em;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
}

.qaf-footer-eq-row .qaf-btn-submit {
  background: #004d37;
  color: #f8fafc;
  font-weight: 500;
}

.qaf-success-footer .qaf-btn-submit {
  background: #004d37;
  color: #f8fafc;
}

.qaf-success-footer .qaf-btn-secondary {
  background: #ffffff;
  border: 1px solid #cad5e2;
  color: #0f172b;
}

.qaf-success-footer .qaf-btn-secondary:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}

.qaf-footer-eq-row--stack .qaf-btn {
  flex: none;
  width: 100%;
}

/* Cancelar: variante Ghost do Figma (sem borda). */
.qaf-footer-eq-row .qaf-btn.qaf-btn--ghost-cancel {
  border: none;
  background: transparent;
  color: #0f172b;
}

.qaf-footer-eq-row .qaf-btn.qaf-btn--ghost-cancel:hover {
  background: #f8fafc;
}

/* Chips Trust-DS–like: fill #F1F5F9, radius 16px, gap 10px, altura 32px (componente «Chips» Figma). */
.qaf-chip-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.qaf-chip {
  border: none;
  background: #f1f5f9;
  color: #0f172b;
  border-radius: 16px;
  min-height: 32px;
  padding: 0 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.05em;
  line-height: 16px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.qaf-chip:hover {
  background: #e2e8f0;
}

.qaf-chip--selected {
  background: #e6f1eb;
  box-shadow: 0 0 0 1px var(--qaf-m-primary);
  color: var(--qaf-m-primary);
}

.qaf-chip:focus-visible {
  outline: 2px solid var(--qaf-m-primary);
  outline-offset: 2px;
}

.qaf-success a:not(.qaf-btn) {
  color: var(--qaf-m-primary);
  font-weight: 600;
}

.qaf-success a:not(.qaf-btn):hover {
  text-decoration: underline;
}

.qaf-video-block {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--qaf-m-border);
}

.qaf-video-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.qaf-rec-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #b91c1c;
}

.qaf-rec-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  animation: qaf-rec-pulse 1.2s ease-in-out infinite;
}

@keyframes qaf-rec-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.45;
    transform: scale(0.85);
  }
}

.qaf-video-meta {
  font-size: 12px;
  color: var(--qaf-m-muted);
}
`;
