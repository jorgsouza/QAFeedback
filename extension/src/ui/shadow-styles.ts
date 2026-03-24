/** Estilos isolados no Shadow DOM (evita conflito com a página). */
export const shadowCss = `
:host {
  all: initial;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: #0f172a;
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
  width: 56px;
  height: 56px;
  padding: 0;
  border-radius: 50%;
  overflow: hidden;
}

.qaf-fab-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border-radius: 50%;
  overflow: hidden;
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

.qaf-fab:hover {
  background: rgba(30, 41, 59, 0.98);
  transform: translateY(-2px);
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.42);
}

.qaf-fab:active {
  transform: translateY(0);
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

.qaf-modal {
  --qaf-m-bg: #0a0a0a;
  --qaf-m-surface: #141414;
  --qaf-m-border: rgba(255, 255, 255, 0.12);
  --qaf-m-text: #fafafa;
  --qaf-m-muted: #a3a3a3;
  --qaf-m-input: #111111;
  --qaf-m-placeholder: #737373;

  position: fixed;
  z-index: 2147483647;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(520px, calc(100vw - 32px));
  max-height: min(640px, calc(100vh - 32px));
  background: var(--qaf-m-bg);
  color: var(--qaf-m-text);
  border: 1px solid var(--qaf-m-border);
  border-radius: 12px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.65);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.qaf-modal-header {
  padding: 20px 20px 16px 24px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--qaf-m-border);
}

.qaf-modal-header-text {
  flex: 1;
  min-width: 0;
}

.qaf-modal-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--qaf-m-text);
}

.qaf-modal-subtitle {
  margin: 0 0 10px 0;
  font-size: 13px;
  line-height: 1.45;
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

.qaf-modal-close {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  margin: -4px -4px 0 0;
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
  background: rgba(255, 255, 255, 0.08);
  color: var(--qaf-m-text);
}

.qaf-repo-bar {
  padding: 14px 24px 4px;
  margin-bottom: 0;
  border-bottom: 1px solid var(--qaf-m-border);
}

.qaf-repo-bar.qaf-field {
  margin-bottom: 0;
}

.qaf-tabs {
  display: flex;
  border-bottom: 1px solid var(--qaf-m-border);
  padding: 0 8px;
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
  color: #d4d4d4;
}

.qaf-tab-active {
  color: var(--qaf-m-text);
  border-bottom-color: var(--qaf-m-text);
}

.qaf-body {
  padding: 18px 24px 20px;
  overflow: auto;
  flex: 1;
  background: var(--qaf-m-bg);
}

.qaf-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.qaf-label {
  font-weight: 600;
  font-size: 13px;
  color: var(--qaf-m-text);
}

.qaf-required { color: #f87171; }

.qaf-input, .qaf-textarea, .qaf-select {
  width: 100%;
  border: 1px solid var(--qaf-m-border);
  border-radius: 8px;
  padding: 10px 12px;
  font: inherit;
  background: var(--qaf-m-input);
  color: var(--qaf-m-text);
}

.qaf-input::placeholder,
.qaf-textarea::placeholder {
  color: var(--qaf-m-placeholder);
}

.qaf-select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23737373' d='M3 4.5L6 7.5L9 4.5'/%3E%3C/svg%3E");
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
  border-radius: 50%;
  border: 1px solid var(--qaf-m-border);
  background: var(--qaf-m-input);
  color: var(--qaf-m-text);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.qaf-dictation-mic-btn--inline {
  width: 40px;
  height: 40px;
}

.qaf-dictation-mic-btn--textarea {
  margin-top: 6px;
}

.qaf-dictation-mic-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.22);
  color: #fff;
}

.qaf-dictation-mic-btn:focus-visible {
  outline: 2px solid var(--qaf-m-accent, #6ea8ff);
  outline-offset: 2px;
}

.qaf-dictation-mic-btn--listening {
  border-color: #c2410c;
  background: rgba(234, 88, 12, 0.2);
  color: #fdba74;
  box-shadow: 0 0 0 1px rgba(234, 88, 12, 0.45);
}

.qaf-dictation-mic-btn--listening:hover {
  background: rgba(234, 88, 12, 0.28);
  border-color: #ea580c;
  color: #ffedd5;
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
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(96, 165, 250, 0.35);
}

.qaf-img-field {
  margin-bottom: 16px;
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
  gap: 10px;
  width: 100%;
  align-items: center;
}

.qaf-btn-ghost {
  border: 1px solid var(--qaf-m-border);
  background: var(--qaf-m-input);
  color: var(--qaf-m-text);
  padding: 8px 12px;
  border-radius: 8px;
  font: inherit;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}

.qaf-btn-ghost:hover {
  background: rgba(255, 255, 255, 0.08);
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
  background: var(--qaf-m-input);
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
  background: rgba(255, 255, 255, 0.06);
}

.qaf-dest-seg-btn-active {
  background: rgba(255, 255, 255, 0.12);
  color: var(--qaf-m-text);
  box-shadow: 0 0 0 1px var(--qaf-m-border) inset;
}

.qaf-dest-hint {
  font-size: 13px;
  color: var(--qaf-m-muted);
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--qaf-m-border);
  background: var(--qaf-m-input);
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
  accent-color: #e5e5e5;
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
  background: #f5f5f5;
  color: #0a0a0a;
}

.qaf-btn-submit:hover:not(:disabled) {
  background: #ffffff;
}

.qaf-btn-submit:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.qaf-btn-secondary {
  border: 1px solid var(--qaf-m-border);
  background: transparent;
  color: var(--qaf-m-text);
}

.qaf-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.2);
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

.qaf-btn-primary { background: #2563eb; color: #fff; border: none; }
.qaf-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.qaf-btn-ghost {
  border: 1px solid var(--qaf-m-border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--qaf-m-text);
}

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
  color: #d4d4d4;
}

.qaf-network-diag {
  font-size: 12px;
  line-height: 1.5;
  color: #bae6fd;
  background: rgba(12, 74, 110, 0.45);
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: 8px;
  padding: 10px 12px;
  margin: 0 0 14px;
}

.qaf-network-diag strong {
  color: #e0f2fe;
}

.qaf-network-diag--error {
  color: #fecaca;
  background: rgba(127, 29, 29, 0.4);
  border-color: rgba(248, 113, 113, 0.4);
}

.qaf-network-diag--error strong {
  color: #fee2e2;
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
  background: rgba(6, 78, 59, 0.35);
  color: #a7f3d0;
  border: 1px solid rgba(52, 211, 153, 0.35);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 0;
  font-size: 14px;
}

.qaf-success a {
  color: #6ee7b7;
  font-weight: 600;
}

.qaf-success a:hover {
  color: #d1fae5;
}
`;
