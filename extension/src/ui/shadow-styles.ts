/** Estilos isolados no Shadow DOM (evita conflito com a página). */
export const shadowCss = `
:host {
  all: initial;
  font-family: "Inter Tight", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: #0f172b;
}

*, *::before, *::after { box-sizing: border-box; }

.qaf-wrap {
  position: fixed;
  z-index: 2147483646;
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

.qaf-mini-actions {
  display: flex;
  gap: 6px;
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
  z-index: 2147483645;
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
  --qaf-m-input: #ffffff;
  --qaf-m-input-border: #cad5e2;
  --qaf-m-placeholder: #94a3b8;
  --qaf-m-primary: #004d37;
  --qaf-m-on-primary: #f8fafc;

  position: fixed;
  z-index: 2147483647;
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

.qaf-modal-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.033em;
  color: var(--qaf-m-text);
}

.qaf-modal-subtitle {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.43;
  letter-spacing: 0.043em;
  color: var(--qaf-m-muted);
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
  border-bottom: 1px solid var(--qaf-m-border);
  margin-top: 16px;
  padding: 0 24px;
  background: var(--qaf-m-bg);
}

.qaf-tab {
  flex: 1;
  border: none;
  background: transparent;
  padding: 12px 12px 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  color: var(--qaf-m-muted);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s ease;
}

.qaf-tab:hover {
  color: var(--qaf-m-text);
}

.qaf-tab-active {
  color: var(--qaf-m-primary);
  border-bottom-color: var(--qaf-m-primary);
}

/* Corpo: gap 20px entre blocos (layout_LT7N9T Figma); padding lateral 24. */
.qaf-body {
  padding: 16px 24px 24px;
  overflow: auto;
  flex: 1;
  background: var(--qaf-m-bg);
}

.qaf-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 20px;
}

/* text-sm/medium (Figma): Inter Tight 14 / medium */
.qaf-label {
  font-weight: 500;
  font-size: 14px;
  letter-spacing: 0.04em;
  color: var(--qaf-m-text);
}

/* Label + chips: gap 14px no Figma (layout_66AZMO). */
.qaf-field--motivo-abertura {
  gap: 14px;
}

.qaf-required { color: #f87171; }

.qaf-input, .qaf-textarea, .qaf-select {
  width: 100%;
  border: 1px solid var(--qaf-m-input-border);
  border-radius: 12px;
  padding: 8px 12px;
  font: inherit;
  background: var(--qaf-m-input);
  color: var(--qaf-m-text);
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
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2362748e' d='M3 4.5L6 7.5L9 4.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

.qaf-textarea { min-height: 88px; resize: vertical; }

.qaf-input-with-mic {
  display: flex;
  align-items: center;
  gap: 8px;
}

.qaf-input-flex {
  flex: 1;
  min-width: 0;
}

.qaf-textarea-with-mic {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.qaf-textarea-flex {
  flex: 1;
  min-width: 0;
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
  border: 1px solid var(--qaf-m-input-border);
  background: var(--qaf-m-input);
  color: var(--qaf-m-text);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.qaf-dictation-mic-btn--inline {
  width: 36px;
  height: 36px;
}

/* Textarea + mic: trigger 32×32 (Figma I11:5123;4:681). */
.qaf-dictation-mic-btn--textarea {
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  margin-top: 0;
  align-self: flex-end;
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

.qaf-dictation-mic-svg {
  display: block;
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
  border: 1px solid var(--qaf-m-input-border);
  background: var(--qaf-m-input);
  color: var(--qaf-m-text);
  padding: 8px 12px;
  border-radius: 12px;
  font: inherit;
  font-weight: 500;
  font-size: 14px;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 24px;
  margin: 0 0 10px;
}

.qaf-route-chip {
  font-size: 12px;
  line-height: 1.3;
  color: var(--qaf-m-muted);
  max-width: min(340px, 72vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
}

.qaf-status-strip-trailing {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.qaf-status-strip-dots {
  display: flex;
  align-items: center;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.qaf-token-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #22c55e;
  box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.35);
}

.qaf-info-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  margin: 0;
  border: none;
  background: transparent;
  color: var(--qaf-m-muted);
  cursor: help;
  border-radius: 6px;
  line-height: 0;
}

.qaf-info-trigger:hover {
  color: var(--qaf-m-primary);
  background: rgba(15, 118, 110, 0.08);
}

.qaf-info-trigger:focus-visible {
  outline: 2px solid var(--qaf-m-primary);
  outline-offset: 2px;
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
  background: var(--qaf-m-primary);
  color: var(--qaf-m-on-primary);
}

.qaf-btn-submit:hover:not(:disabled) {
  filter: brightness(1.06);
}

.qaf-btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.qaf-btn-secondary {
  border: 1px solid var(--qaf-m-input-border);
  background: transparent;
  color: var(--qaf-m-text);
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
  border: 1px solid var(--qaf-m-border);
  border-radius: 8px;
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
  background: transparent;
  color: var(--qaf-m-text);
  border: none;
  border-radius: 0;
  padding: 8px 0 0;
  margin-bottom: 0;
  font-size: 14px;
}

.qaf-success-hero {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.qaf-success-check {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #dcfce7;
  color: #166534;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  flex-shrink: 0;
}

.qaf-success-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--qaf-m-text);
}

.qaf-success-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.qaf-success-card {
  border: 1px solid var(--qaf-m-border);
  border-radius: 12px;
  padding: 14px 16px;
  background: var(--qaf-m-bg);
}

.qaf-success-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  font-weight: 600;
  font-size: 14px;
  color: var(--qaf-m-text);
}

.qaf-success-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.qaf-success-card-actions a.qaf-btn {
  text-decoration: none;
  box-sizing: border-box;
}

.qaf-btn-sm {
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
}

.qaf-footer-eq {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  padding-top: 20px;
  border-top: 1px solid var(--qaf-m-border);
}

.qaf-footer-eq-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  width: 100%;
}

.qaf-footer-eq-row .qaf-btn {
  flex: 1;
  justify-content: center;
  border-radius: 12px;
  min-height: 48px;
  padding: 8px 16px;
  font-weight: 500;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* Cancelar: variante Ghost do Figma (sem borda). */
.qaf-footer-eq-row .qaf-btn.qaf-btn--ghost-cancel {
  border: none;
  background: transparent;
  color: var(--qaf-m-text);
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
  line-height: 1.33;
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

.qaf-success a {
  color: var(--qaf-m-primary);
  font-weight: 600;
}

.qaf-success a:hover {
  text-decoration: underline;
}
`;
