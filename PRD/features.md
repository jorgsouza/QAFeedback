Perfeito. Vou aprofundar exatamente nessa linha: **por que cada dado importa**, **o que pode ser coletado sem intervenção humana** e **como isso deve aparecer na issue para ficar cristalino para quem vai debugar**.

Hoje o seu QAFeedback já coleta uma base muito útil — URL, viewport, tela, DPR, user agent, indício de desktop/mobile, elemento clicado/focado, console, falhas de fetch, captura de imagem, preview em Markdown e HAR opcional. Isso mostra que a extensão já está no ponto de sair de “formulário manual” para virar uma camada real de contexto técnico.  

---

# Como eu detalharia os 8 pontos

## 1. Linha do tempo de ações do usuário

### Por que isso importa

Esse é um dos dados mais valiosos porque reduz a maior dor do dev ao receber bug:
**“como exatamente essa pessoa chegou nesse estado?”**

Muita issue vem com “deu erro ao salvar”, mas o problema pode depender de:

* clicar duas vezes;
* mudar filtro antes da tela terminar de carregar;
* abrir modal, voltar, reenviar;
* trocar aba;
* preencher campos em ordem específica.

Sem timeline, o dev precisa reconstruir tudo no escuro.

### O que pode ser extraído automaticamente

Quase tudo aqui pode ser automático, sem atrapalhar o QA:

* cliques relevantes;
* submit de formulário;
* change/input em campos;
* navegação de rota em SPA;
* mudança de query param;
* scroll relevante;
* foco/blur em campos;
* abertura/fechamento de modal;
* teclas relevantes como Enter, Tab, Escape.

Você não precisa registrar “tudo sempre”. O ideal é guardar um **buffer dos últimos 20–50 eventos significativos**.

### O que evitar

Não registrar texto sensível bruto digitado.
Melhor salvar algo assim:

* `input[name=email] -> valor mascarado`
* `campo senha alterado`
* `checkbox X marcado`

### Como isso deve aparecer na issue

Não em formato cru. Deve virar algo como:

```md
## Linha do tempo da interação
1. Acessou /minha-conta/pedidos
2. Clicou em "Solicitar reembolso"
3. Preencheu campo "Motivo"
4. Alterou quantidade para 2
5. Clicou em "Confirmar"
6. Modal fechou sem mensagem de sucesso
7. Requisição POST /refund retornou 500
```

Para o dev, isso já vira quase um roteiro de reprodução.

---

## 2. XHR/fetch mais ricos, não só falhas

### Por que isso importa

Porque bug não vive só em 500.
Às vezes o backend devolve:

* 200 com payload inválido;
* 204 quando a UI espera body;
* 422 de validação;
* 401 por expiração silenciosa;
* resposta lenta que quebra UX;
* race condition entre duas chamadas.

Se você capturar apenas “falhou”, perde metade do diagnóstico.

### O que pode ser extraído automaticamente

Sem interferência humana, dá para capturar:

* método;
* URL sanitizada;
* status;
* duração;
* timestamp;
* content-type;
* tamanho aproximado da resposta;
* se foi abortada/cancelada;
* correlation ID / request ID dos headers;
* sequência entre requests.

Num segundo momento:

* payload sanitizado;
* resposta resumida/sanitizada;
* identificação de chamada lenta.

### O que evitar

Não anexar body completo de tudo, porque:

* gera ruído;
* pode vazar PII;
* deixa issue pesada.

Melhor anexar:

* requests críticas;
* requests com erro;
* requests lentas;
* request imediatamente anterior ao bug.

### Como isso deve aparecer na issue

Em vez de despejar um HAR inteiro na cara do dev:

```md
## Requisições relevantes
- POST /api/refunds -> 500 em 1.8s
- GET /api/orders/123 -> 200 em 320ms
- POST /api/refunds/validate -> 422 em 210ms

## Headers úteis
- x-request-id: 8f31a2...
- x-correlation-id: 91ab77...
```

E o HAR fica como anexo de apoio, não como corpo principal.

---

## 3. Estado visual da página

### Por que isso importa

Porque muita issue é visual, contextual ou depende do estado da interface:

* modal aberto;
* botão desabilitado;
* spinner infinito;
* aba errada ativa;
* skeleton não some;
* layout quebrado em viewport específica.

O screenshot ajuda, mas sozinho não explica o estado.

### O que pode ser extraído automaticamente

Sem o QA fazer nada extra:

* viewport;
* resolução da tela;
* zoom estimado;
* dark/light mode;
* idioma da página;
* rota atual;
* modais visíveis;
* tabs/accordions ativos;
* presença de spinner/loading;
* seletor e bounding box do elemento em foco;
* texto visível do CTA acionado.

### O que isso resolve

Ajuda muito em:

* bug visual;
* bug de responsividade;
* bug de estado inconsistente;
* bug de carregamento infinito.

### Como isso deve aparecer na issue

```md
## Estado visual no momento do bug
- Tema: dark
- Viewport: 390x844
- Modal visível: "Solicitar reembolso"
- Aba ativa: "Dados bancários"
- Botão acionado: "Confirmar"
- Spinner permaneceu visível por mais de 10s
```

Isso deixa a issue muito mais reproduzível.

---

## 4. Erros de runtime mais ricos

### Por que isso importa

Console solto ajuda, mas ainda é barulho.
O dev precisa entender:

* qual erro veio primeiro;
* qual erro é consequência;
* qual stack parece a raiz;
* o que aconteceu perto do bug.

### O que pode ser extraído automaticamente

* `window.onerror`
* `unhandledrejection`
* tipo do erro;
* mensagem;
* stack trace;
* arquivo/linha/coluna;
* contagem de repetição;
* primeiro erro da sessão;
* último erro antes do report.

### O que isso melhora

Em vez de mandar “console com 18 warns”, você manda:

* erro mais relevante;
* contexto temporal;
* assinatura do erro.

### Como isso deve aparecer na issue

```md
## Erro de runtime principal
TypeError: Cannot read properties of undefined (reading 'id')
at RefundSummary.tsx:87

## Contexto
- Primeiro apareceu às 14:22:11
- Repetiu 3 vezes
- Última ocorrência: imediatamente após clicar em "Confirmar"
```

Isso é muito mais útil do que um dump cru.

---

## 5. Ambiente e sessão

### Por que isso importa

Boa parte dos bugs “não reproduzo” vem daqui:

* feature flag ligada só para alguns;
* ambiente diferente;
* tenant/cliente específico;
* perfil de permissão;
* experimento A/B;
* build diferente;
* usuário com estado legado.

### O que pode ser extraído automaticamente

Se o app expuser isso no front, ou se você conseguir ler com segurança:

* build id / commit sha;
* nome do ambiente;
* tenant;
* role/perfil;
* locale;
* timezone;
* feature flags;
* experimentos ativos;
* usuário mascarado;
* versionamento da aplicação.

### O que isso evita

Evita o clássico:
“aqui funciona”
porque o dev está testando em outro estado de sessão.

### Como isso deve aparecer na issue

```md
## Contexto de ambiente
- Ambiente: staging
- Build: 2026.03.25-rc12
- Commit: 81ac9d2
- Tenant: b2c
- Perfil: usuário autenticado
- Feature flags: refund_new_flow=on, pix_v2=off
- Experimento: checkout-copy-test=B
```

Isso é ouro para filtrar a superfície do problema.

---

## 6. Performance contextual

### Por que isso importa

Porque às vezes o bug é funcional só na aparência.
Na verdade ele é:

* timeout;
* UI congelada;
* loading tardio;
* layout shift que faz o QA clicar errado;
* resposta tão lenta que parece quebra.

### O que pode ser extraído automaticamente

* LCP/CLS/INP observados na sessão;
* long tasks;
* tempo de requests críticas;
* event loop bloqueado;
* recursos lentos;
* erros de carregamento;
* memory hints quando possível.

### O que isso ajuda a distinguir

“Bug de regra” vs “bug causado por degradação”.

### Como isso deve aparecer na issue

```md
## Sinais de performance na sessão
- LCP observado: 4.1s
- INP observado: 480ms
- CLS observado: 0.19
- Long task: 820ms antes do clique em "Confirmar"
- POST /refund levou 1.8s
```

Aí a issue já chega com cheiro de causa.

---

## 7. DOM/selector snapshot

### Por que isso importa

Porque o dev precisa localizar rápido o alvo do problema no código/UI.

Só print nem sempre basta, principalmente quando a tela é grande ou dinâmica.

### O que pode ser extraído automaticamente

* tag;
* id;
* classes;
* `data-testid`;
* `data-qa`;
* `name`;
* `role`;
* `aria-label`;
* texto do elemento;
* parent chain resumida;
* posição e tamanho.

### O que isso habilita

* achar componente mais rápido;
* cruzar com testes automatizados;
* localizar seletor do CTA ou campo afetado.

### Como isso deve aparecer na issue

```md
## Elemento relacionado
- tag: button
- texto: "Confirmar"
- data-testid: refund-confirm-button
- aria-label: Confirmar solicitação de reembolso
- seletor sugerido: [data-testid="refund-confirm-button"]
```

Para dev e QA isso é extremamente útil.

---

## 8. Privacidade e sanificação

### Por que isso importa

Porque quanto melhor a coleta, maior o risco de capturar dado sensível sem querer.

Se isso não nascer bem desenhado, a extensão pode virar risco de segurança e adoção.

### O que pode ser extraído automaticamente com segurança

Desde que com sanificação:

* URL sem tokens;
* headers com redaction;
* campos mascarados;
* user id parcial;
* payload resumido;
* logs filtrados.

### O que precisa existir

* redaction por regex;
* redaction por nome de header;
* redaction por seletor CSS;
* denylist por rota;
* modo seguro por domínio;
* opção de desligar capturas específicas.

### Como isso deve aparecer na issue

A issue deve mostrar:

```md
## Dados sensíveis
- Authorization: [REDACTED]
- Cookie: [REDACTED]
- email do usuário: j***@empresa.com
- CPF: [REDACTED]
```

Isso passa confiança e viabiliza uso em contexto real.

---

# O que deve ser 100% automático vs opcional

## Automático por padrão

Eu deixaria automático:

* URL e rota;
* timestamp;
* viewport/tela/DPR;
* user agent/browser;
* ambiente/build/flags se disponível;
* últimos eventos relevantes;
* erro principal de runtime;
* últimas requests relevantes;
* elemento clicado/focado;
* screenshot no momento da abertura;
* sinais básicos de performance;
* sanificação.

## Opcional por toggle

Eu deixaria opcional:

* HAR completo;
* payload/resposta de requests;
* screenshot adicional por região;
* coleta estendida de console;
* gravação/replay;
* anexos extras.

Assim você reduz atrito e mantém segurança.

---

# Como montar a issue para ficar fácil para o dev

A regra aqui é simples:
**não despejar telemetria crua.**
Transformar a coleta em um relatório claro.

Eu estruturaria a issue assim:

```md
# Resumo do problema
Ao clicar em "Confirmar" no fluxo de reembolso, o modal fecha sem feedback e a solicitação não é concluída.

## Passos prováveis para reproduzir
1. Acessar /minha-conta/pedidos
2. Abrir pedido 123
3. Clicar em "Solicitar reembolso"
4. Preencher motivo
5. Clicar em "Confirmar"

## Resultado observado
- Modal fecha sem mensagem
- Requisição POST /refund retorna 500
- Erro de runtime após o clique

## Resultado esperado
A solicitação deve ser enviada com confirmação visual de sucesso.

## Ambiente
- staging
- build 2026.03.25-rc12
- commit 81ac9d2
- flag refund_new_flow=on

## Contexto técnico
- Viewport: 390x844
- Tema: dark
- Elemento: button[data-testid="refund-confirm-button"]
- x-request-id: 8f31a2...

## Erro principal
TypeError: Cannot read properties of undefined (reading 'id')
RefundSummary.tsx:87

## Requisições relevantes
- POST /api/refund -> 500 em 1.8s
- GET /api/orders/123 -> 200 em 320ms

## Evidências
- screenshot anexado
- HAR anexado
```

Isso deixa a issue pronta para triagem e debugging.

---

# Plano para o Cursor — 8 etapas detalhadas

Abaixo está um plano em formato que você pode usar como base no Cursor.

---

## Etapa 1 — Criar o modelo de captura automática de contexto

**Objetivo:** definir a arquitetura dos dados antes de sair codando.

### Fazer

* criar um contrato `CapturedIssueContext`;
* separar em blocos:

  * session
  * page
  * uiState
  * interactionTimeline
  * network
  * runtimeErrors
  * performance
  * privacy;
* definir limites:

  * máximo de eventos;
  * máximo de requests;
  * máximo de logs;
* definir política de retenção em memória;
* definir o que é automático e o que é opcional.

### Entregável

* types/interfaces claras;
* ADR curta explicando trade-offs;
* payload estável para a geração da issue.

---

## Etapa 2 — Implementar timeline de interação do usuário

**Objetivo:** capturar passos de reprodução automáticos.

### Fazer

* adicionar listeners para:

  * click
  * input/change
  * submit
  * focus/blur
  * keydown relevante
  * route/navigation;
* registrar só eventos significativos;
* manter ring buffer dos últimos 20–50 eventos;
* mascarar campos sensíveis;
* ignorar interação interna da própria extensão.

### Entregável

* timeline pronta no payload;
* utilitário que converte eventos brutos em texto legível.

---

## Etapa 3 — Evoluir captura de rede para requests relevantes

**Objetivo:** dar contexto real de API sem poluir a issue.

### Fazer

* expandir o bridge/camada de rede para capturar:

  * método
  * URL sanitizada
  * status
  * duração
  * timestamp;
* marcar requests:

  * com erro
  * lentas
  * imediatamente próximas ao bug;
* capturar correlation/request ids;
* manter redaction de headers;
* limitar volume.

### Entregável

* resumo de requests relevantes;
* anexo HAR opcional mantido como suporte.

---

## Etapa 4 — Capturar estado visual e DOM snapshot

**Objetivo:** facilitar reprodução e localização do componente.

### Fazer

* registrar:

  * modais visíveis
  * tabs/accordions ativos
  * presença de spinner
  * tema
  * locale
  * zoom hint;
* melhorar snapshot do elemento alvo:

  * texto
  * role
  * data-testid
  * aria-label
  * seletor sugerido
  * bounding rect;
* destacar elemento no screenshot quando possível.

### Entregável

* bloco `uiState`;
* bloco `targetElement`;
* screenshot contextual mais útil.

---

## Etapa 5 — Enriquecer erros de runtime e sinais de performance

**Objetivo:** destacar causa provável e não só sintomas.

### Fazer

* capturar `window.onerror` e `unhandledrejection`;
* agrupar erros repetidos;
* guardar primeiro e último erro relevantes;
* registrar métricas de sessão:

  * LCP
  * CLS
  * INP
  * long tasks;
* correlacionar temporalmente erro, clique e request.

### Entregável

* resumo do erro principal;
* bloco de performance contextual;
* base para priorização automática.

---

## Etapa 6 — Construir pipeline de sanificação e segurança

**Objetivo:** tornar a coleta segura para uso real.

### Fazer

* criar módulo central de redaction;
* mascarar:

  * Authorization
  * Cookie
  * tokens
  * emails
  * CPF/telefone;
* suportar:

  * denylist por rota
  * denylist por seletor
  * denylist por header;
* criar modo “safe capture” por domínio;
* documentar claramente o que é coletado.

### Entregável

* pipeline único de sanitização antes de salvar/anexar/enviar;
* logs internos sem PII.

---

## Etapa 7 — Gerar issue legível automaticamente

**Objetivo:** converter telemetria em relato claro para dev.

### Fazer

* criar um `IssueNarrativeBuilder`;
* transformar contexto bruto em seções:

  * resumo
  * passos de reprodução
  * resultado observado
  * resultado esperado
  * ambiente
  * erro principal
  * requests relevantes
  * evidências;
* priorizar clareza e concisão;
* manter modo preview editável;
* padronizar markdown para GitHub/Jira.

### Entregável

* template de issue muito melhor;
* payload técnico separado do payload narrativo.

---

## Etapa 8 — Adicionar IA para triagem e enriquecimento

**Objetivo:** automatizar entendimento e reduzir trabalho manual do QA.

### Fazer

* usar IA para:

  * sugerir título;
  * resumir problema;
  * inferir passos de reprodução;
  * separar atual vs esperado;
  * sugerir severidade;
  * sugerir labels/componentes/squad;
  * detectar duplicidade futura;
* usar como entrada:

  * timeline
  * requests
  * runtime error
  * environment
  * screenshot metadata;
* manter saída revisável antes do envio.

### Entregável

* issue quase pronta automaticamente;
* base para evolução posterior de deduplicação e geração de teste.

---

# Ordem ideal de execução

Se você quiser maximizar resultado rápido, eu faria nessa ordem:

**1. Etapa 1** — modelo
**2. Etapa 2** — timeline
**3. Etapa 3** — rede
**4. Etapa 7** — narrativa da issue
**5. Etapa 4** — estado visual/DOM
**6. Etapa 5** — runtime + performance
**7. Etapa 6** — privacy hardening
**8. Etapa 8** — IA

Porque o maior ganho inicial vem de:
**timeline + network + narrative builder**.

Isso sozinho já faz a issue ficar muito mais fácil para o dev.

Se você quiser, no próximo passo eu transformo isso em um **`plan.md` pronto para o Cursor**, já com checklist, critérios de aceite, riscos e definição de pronto por etapa.
