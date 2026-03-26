# Plano: Captura de região (viewport) para anexos Jira

> Objetivo: fluxo parecido com “escolher o que capturar” — esconder a UI da extensão, selecionar um retângulo na área visível, capturar e voltar com imagem anexada ao modal (reutiliza pipeline existente de prints).

## Decisões

- **API:** `chrome.tabs.captureVisibleTab` no service worker (já há `activeTab` + permissões de host nos sites permitidos).
- **Área:** só o **viewport visível** (o que está na tela), alinhado ao que a API devolve.
- **Seleção:** overlay **próprio** na página (arrastar retângulo), não o diálogo nativo do Ubuntu.
- **Ordem crítica:** esconder host `#qa-feedback-extension-root` → remover overlay → `requestAnimationFrame` → capturar → recortar em canvas → mostrar host de novo.
- **Mapeamento:** rect em coordenadas de viewport (CSS px) → pixels da imagem via `naturalWidth/Height` vs `innerWidth/innerHeight`.

## Fases (implementação única neste PR)

1. **Mensagem `CAPTURE_VISIBLE_TAB`** no SW + teste manual.
2. **Módulo de mapeamento** (função pura + testes Vitest).
3. **Overlay + orquestração** no content bundle; botão no bloco “Prints para o Jira”.
4. **Docs** (`DOCUMENTATION.md` / `README` curto se necessário).

## Critérios de aceitação

- [ ] Com Jira selecionado, botão inicia modo captura; **Esc** cancela; **Enter** ou botão confirma (área mínima definida).
- [ ] Após captura, a UI da extensão volta visível e a imagem aparece na lista de anexos.
- [ ] Falha de permissão/capture comunicada sem deixar a UI escondida.
- [ ] `npm run check` e `npm test` passam.
