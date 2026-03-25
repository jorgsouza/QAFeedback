# QAFeedback — Plano revisado para debug interno, segurança pragmática e evolução do produto

> **PRD-009** — maturidade do produto. Índice: [`prd/INDEX.md`](../INDEX.md).

> Este plano revisa o plano anterior com base em:
> - o estado atual do código do QAFeedback;
> - o contexto real de uso informado: QA interno, majoritariamente em stage / TST / evolução, com casos pontuais de testes em produção;
> - a necessidade de **preservar contexto máximo para diagnóstico** sem perder visibilidade de **riscos de segurança na aplicação web** (exposição de credenciais, sessão, PII, misconfiguration, sinais de injeção ou transporte inseguro). O alinhamento conceitual segue o ecossistema **[OWASP](https://owasp.org/)** (ex.: *Top 10*, *Cheat Sheets*, *ASVS* como referência de categorias); **não** se pretende cobertura completa nem certificação — apenas **heurísticas úteis** para QA interno sinalizar **pontos críticos** típicos de apps web.
>
> Diretriz central desta revisão:
>
> **não tratar a extensão como ferramenta pública com sanitização agressiva por padrão**.
>
> Em vez disso, o foco passa a ser:
> - manter alto poder de diagnóstico;
> - evitar apenas exposição acidental desnecessária;
> - detectar e sinalizar achados sensíveis;
> - preparar o produto para operar com dois modos:
>   - debug interno;
>   - produção sensível.

---

# 1. Resumo executivo

## 1.1. O que foi reavaliado
O plano anterior colocava muita ênfase em endurecer a sanitização logo no começo.
Após reanalisar o código e considerar o uso real da ferramenta, a conclusão é:

**a sanitização atual já cobre o mínimo mais importante e não deve ser endurecida agressivamente agora.**

Hoje o projeto já faz duas coisas relevantes:
- remove query string e hash da URL;
- filtra atributos explicitamente sensíveis por nome.  

Isso aparece no módulo `sanitizer.ts`, o que já reduz parte importante do risco sem matar o valor diagnóstico.  
Além disso, o restante da arquitetura já está montado para capturar:
- timeline;
- requests relevantes;
- runtime errors;
- performance;
- hints de DOM;
- estado visual.

Ou seja: o produto já não depende tanto de “dados crus infinitos”, mas também **ainda não está num ponto em que valha a pena mutilar a captura**.

## 1.2. Decisão revisada
Em vez de “endurecer sanitização” como primeira prioridade, a nova direção é:

1. **preservar a riqueza de contexto para debugging interno**;
2. **detectar automaticamente possíveis achados sensíveis**;
3. **controlar como a evidência aparece na issue**;
4. **deixar sanitização mais forte como capacidade opcional / por modo**, não como default agressivo.

## 1.3. O que muda na prática
A nova prioridade deixa de ser:
- “mascarar muito”

e passa a ser:
- “diagnosticar bem”
- “detectar exposição sensível”
- “escalar a gravidade quando houver indício de segurança”
- “controlar corpo da issue vs evidência anexa”

---

# 2. Diretriz principal

## 2.1. O problema que este plano resolve
Hoje o QAFeedback já ajuda muito na abertura de issues, mas ele ainda pode evoluir em três direções muito importantes:

- **ficar melhor para debugging real**
- **ficar melhor para detectar problemas de segurança**
- **ficar mais coerente com seu uso interno**

## 2.2. Princípio orientador
Este plano segue o princípio:

> **Preservar o máximo de contexto útil para reproduzir e diagnosticar bugs, ao mesmo tempo em que detecta e destaca achados sensíveis sem apagar evidências importantes.**

## 2.3. Regra prática
Antes de mascarar qualquer dado, fazer sempre a pergunta:

> “Esse dado ajuda o dev a entender a causa, reproduzir o bug ou identificar um achado de segurança?”

Se sim:
- manter no fluxo, resumido ou controlado.

Se não:
- remover ou mascarar.

---

# 3. Avaliação revisada da sanitização atual

## 3.1. O que o código já faz bem
O código atual já implementa uma base razoável de sanitização leve:

- `sanitizeUrl(raw)` remove `query` e `hash`;
- `sanitizeElementAttributes(el)` ignora atributos como:
  - `password`
  - `token`
  - `authorization`
  - `cookie`
  - `set-cookie`
  - `secret`
  - `api-key`
- atributos inline `on*` também são ignorados.

Isso, para o seu cenário, já é um bom mínimo.

## 3.2. Conclusão revisada
**Não recomendo tratar a sanitização atual como “insuficiente crítica” neste momento.**

Ela ainda pode melhorar, mas:
- não é o maior gargalo do produto;
- não deveria virar o foco número 1;
- pode até ser relaxada conceitualmente em favor de diagnóstico, desde que acompanhada por:
  - detecção de achados sensíveis;
  - modos de captura;
  - organização melhor da issue.

## 3.3. Onde ainda vale melhorar, mas sem radicalizar
As melhorias recomendadas agora são:
- centralizar melhor regras;
- detectar padrões sensíveis;
- separar “mostrar o achado” de “expor o valor bruto inteiro”;
- introduzir modos operacionais.

Não é necessário agora:
- blacklist enorme;
- allowlist muito restrita;
- ocultar agressivamente texto de alvo;
- empobrecer timeline ou requests.

---

# 4. Nova visão de produto

O QAFeedback deve evoluir para operar com três capacidades principais:

## 4.1. Captura de contexto técnico
Continua sendo o núcleo:
- timeline;
- request;
- runtime;
- visual state;
- target DOM;
- ambiente da aplicação;
- performance.

## 4.2. Narrativa para engenharia
A issue precisa responder rapidamente:
- o que aconteceu;
- em qual contexto;
- qual ação precedeu o problema;
- qual request/erro parece central;
- o que o dev deve olhar primeiro.

## 4.3. Detecção de achados sensíveis e segurança
A extensão deve ajudar a **sinalizar** indícios de problemas de segurança **no contexto do browser e da página** — o mesmo “tipo de preocupação” que guias OWASP para aplicações web ([OWASP Foundation](https://owasp.org/)), mas **de forma pragmática**: lista curta de **achados de alto valor**, não varredura exaustiva.

**Âmbito intencional (MVP de detecção):** heurísticas sobre dados já capturados (rede resumida, headers visíveis, console, runtime, DOM alvo, URLs sanitizadas). **Fora de âmbito por agora:** pentest automatizado, análise de servidor, conformidade total ASVS/Top 10.

**Categorias-alvo (inspiração OWASP; exemplos de o que procurar):**

| Ângulo (referência OWASP) | O que a extensão pode tentar detetar (heurística) |
|---------------------------|---------------------------------------------------|
| **A02 — falhas criptográficas / segredos** | JWT-like, `Bearer`, API keys, segredos longos, credenciais em query (já removida da URL na issue — sinalizar se apareceu noutro sítio), material criptográfico em texto claro. |
| **A05 — misconfiguration / headers** | `Set-Cookie` sem flags de segurança esperadas (ex.: `Secure`/`HttpOnly` em contexto HTTPS), headers de segurança ausentes ou fracos **se** estiverem no payload visível ao content script, CORS/reflected hints **apenas** se aparecerem em texto capturado. |
| **A07 — falhas de identificação / sessão** | Cookies de sessão com nomes conhecidos, tokens em resposta/console, session fixation **não** — só exposição visível. |
| **A03 — injeção (sinais fracos)** | Mensagens de erro de runtime/console com padrões típicos de SQL/HTML/JSON que **sugerem** input refletido ou erro de parser (marcar como *baixa confiança*, nunca como “confirmado”). |
| **PII / dados sensíveis** | e-mail, CPF, outros identificadores em DOM, console ou corpo visível. |
| **Transporte / conteúdo misto** | Indícios de recurso HTTP em página HTTPS se observável no texto capturado (best-effort). |

**Saída esperada na issue:** secção dedicada com **tipo provável**, **fonte** (rede / console / DOM / erro), **severidade sugerida**, **preview truncado** — sem afirmar CVE nem “vulnerabilidade confirmada”.

Isso é diferente de apenas “sanitizar”: o produto **destaca** possíveis achados de segurança para o dev investigar, preservando o mínimo de contexto para reprodução.

---

# 5. Plano detalhado revisado — 8 etapas

---

## ETAPA 1 — Criar camada de “detecção de achados sensíveis” em vez de reforçar sanitização agressiva

### Objetivo
Detectar automaticamente possíveis sinais de vazamento ou exposição indevida de dados sensíveis e refletir isso na issue.

### Por que esta etapa vem primeiro
Porque, no seu contexto, o maior valor não está em esconder.
Está em:
- identificar exposição sensível;
- avisar o dev;
- destacar severidade;
- preservar contexto de investigação.

### O que implementar

#### 1.1. Criar módulo dedicado de detecção
Novo módulo sugerido:
- `extension/src/shared/sensitive-findings.ts`

Esse módulo deve inspecionar conteúdos já capturados e procurar **padrões e classes de risco** (tendência a **não perder** indícios reais; falsos positivos possíveis desde que **rotulados** como incertos), alinhados às categorias da §4.3:

- **Segredos / sessão:** JWT-like, `Bearer …`, cookies com nomes críticos, `Set-Cookie` visível, strings com cara de API key ou token em console/runtime.
- **PII:** e-mails, CPF, outros identificadores óbvios em texto capturado.
- **Headers / configuração:** presença ou ausência de cabeçalhos sensíveis ou de segurança **quando** refletidos no que a extensão já vê (ex.: lista de nomes de header conhecidos; avisos de cookie “solto”).
- **Injeção (heurística fraca):** fragmentos em erros/console que sugiram SQL/HTML/JSON quebrado por input (marcar **confiança baixa**).
- **Transporte:** menções a `http://` em conteúdo capturado quando a página é HTTPS (mixed content — best-effort).
- **Credenciais / dados em sitio errado:** números longos com cara de segredo; dados que parecem credenciais em DOM visível ou mensagens de rede (sem assumir formato fixo).

#### 1.2. Definir tipos para findings
Adicionar em `types.ts` algo como:
- `SensitiveFindingV1`

Sugestão de campos:
- `kind`
- `severity`
- `source`
- `location`
- `summary`
- `evidenceFingerprint`
- `samplePreview`
- `actionSuggested`

#### 1.3. Fontes inspecionadas
Aplicar a detecção em:
- `statusText` de request resumida;
- nomes de headers conhecidos;
- request ids/correlation ids apenas para heurística leve;
- console message;
- runtime error message;
- texto de atributos DOM;
- texto visível do alvo;
- futuros campos de ambiente, quando houver.

#### 1.4. Não expor tudo no corpo principal
A ideia não é imprimir token completo no corpo da issue.
A ideia é gerar algo como:

- tipo provável de dado sensível;
- local da exposição;
- fingerprint / preview curto;
- severidade sugerida.

#### 1.5. Builder deve renderizar seção específica
Nova seção:
- `## Achados sensíveis / segurança`

Exemplo esperado:
- Possível **segredo ou token** (JWT/Bearer/API key) em resposta, header ou console
- Possível **cookie de sessão** ou `Set-Cookie` com flags inadequadas (contexto HTTPS)
- Possível **PII** em console ou DOM
- Indício **fraco** de mensagem compatível com **injeção** (SQL/HTML) em erro de runtime — revisar manualmente
- Indício de **conteúdo misto** ou URL insegura em recurso referenciado no texto capturado

### Arquivos a tocar
- novo: `extension/src/shared/sensitive-findings.ts`
- `extension/src/shared/types.ts`
- `extension/src/shared/context-collector.ts`
- `extension/src/shared/issue-builder.ts`

### Critérios de aceite
- o sistema detecta indícios úteis sem quebrar captura atual;
- a issue destaca achados sensíveis;
- a evidência aparece de forma controlada.

### O que o Cursor deve evitar aqui
- não imprimir segredos completos por padrão;
- não inferir vulnerabilidade com excesso de certeza;
- não transformar tudo em “security finding”.

---

## ETAPA 2 — Introduzir modos operacionais de captura

### Objetivo
Permitir que a extensão se comporte de forma diferente dependendo do contexto de uso.

### Problema que resolve
Seu cenário não é uniforme:
- stage / TST / evolução
- produção com testes críticos

Esses contextos pedem profundidades diferentes.

### Modos sugeridos

#### 2.1. Modo `debug-interno`
Default recomendado.
Comportamento:
- preserva máximo contexto;
- usa sanitização leve atual;
- mantém riqueza de requests, timeline, DOM hint, runtime, performance;
- ativa detecção de achados sensíveis;
- favorece diagnóstico.

#### 2.2. Modo `producao-sensivel`
Comportamento:
- continua detectando achados sensíveis;
- reduz exposição bruta no corpo da issue;
- privilegia fingerprint / preview curto;
- mantém contexto suficiente para investigação.

#### 2.3. Modo `seguranca`
Opcional para o futuro.
Comportamento:
- prioriza detection;
- eleva labels/severidade;
- pode mudar template do report.

### O que implementar

#### 2.4. Adicionar campo em settings
Exemplo:
- `captureMode: "debug-interno" | "producao-sensivel"`

#### 2.5. Fazer collector e builder respeitarem o modo
- em debug interno: manter atual quase todo;
- em produção sensível: esconder só o valor cru mais arriscado;
- findings continuam aparecendo em ambos.

### Arquivos a tocar
- `extension/src/shared/types.ts`
- `extension/src/shared/storage.ts`
- `extension/src/shared/context-collector.ts`
- `extension/src/shared/issue-builder.ts`
- opções da extensão

### Critérios de aceite
- modo fica configurável;
- markdown muda conforme modo;
- o modo default não empobrece o produto.

---

## ETAPA 3 — Capturar ambiente da aplicação

### Objetivo
Reduzir “não reproduzo” adicionando metadados funcionais da app.

### Justificativa
Hoje o produto já captura bem browser/página.
Agora o ganho mais importante está em capturar:
- build;
- release;
- commit;
- flag;
- tenant;
- role;
- experimento.

### O que implementar

#### 3.1. Criar módulo específico
Novo módulo:
- `extension/src/shared/app-environment-capture.ts`

#### 3.2. Estratégia best-effort
Tentar ler de fontes como:
- `window.__APP_CONFIG__`
- `window.__NEXT_DATA__`
- `window.__INITIAL_STATE__`
- meta tags
- atributos no DOM
- variáveis globais conhecidas
- localStorage / sessionStorage com allowlist

#### 3.3. Estrutura sugerida
Adicionar em `types.ts`:
- `appEnvironment?: { ... }`

Campos sugeridos:
- `appName`
- `environmentName`
- `buildId`
- `release`
- `commitSha`
- `tenant`
- `role`
- `featureFlags`
- `experiments`

#### 3.4. Renderização na issue
Nova seção:
- `## Contexto da aplicação`

### Arquivos a tocar
- novo: `extension/src/shared/app-environment-capture.ts`
- `extension/src/shared/types.ts`
- `extension/src/shared/context-collector.ts`
- `extension/src/shared/issue-builder.ts`

### Critérios de aceite
- ausência de ambiente não quebra issue;
- presença de ambiente melhora muito o diagnóstico;
- valores continuam truncados e controlados.

---

## ETAPA 4 — Melhorar correlação entre ação, request, erro e estado visual

### Objetivo
Transformar a issue em algo mais investigativo.

### Problema atual
Hoje o sistema já lista vários sinais, mas ainda não costura bem:
- o clique que antecedeu;
- a request mais relacionada;
- o erro mais provável;
- o estado visual no momento.

### O que implementar

#### 4.1. Janela temporal de correlação
Definir janela para buscar:
- requests após clique/submit;
- erro principal após interação;
- visual state ativo nesse intervalo.

#### 4.2. Requests correlacionadas
Adicionar ao summary:
- `deltaToLastActionMs`
- `triggerKind` opcional
- `isCorrelated`

#### 4.3. Erro principal mais inteligente
Parar de depender só do “último erro”.
Priorizar:
- proximidade temporal;
- repetição;
- relação com request relevante;
- stack útil.

#### 4.4. Narrativa de highlight
Melhorar `issue-narrative.ts` para gerar algo como:
- após clicar em X, a request Y falhou;
- logo depois surgiu erro Z;
- havia modal aberto/spinner ativo.

### Arquivos a tocar
- `extension/src/shared/context-collector.ts`
- `extension/src/shared/network-summary.ts`
- `extension/src/shared/issue-narrative.ts`
- `extension/src/shared/issue-builder.ts`

### Critérios de aceite
- issue fica mais orientada a causa provável;
- sem inventar causalidade forte demais;
- aumenta clareza para dev.

---

## ETAPA 5 — Evoluir timeline de interação sem perder legibilidade

### Objetivo
Deixar a timeline mais útil para reproduzir fluxo, mas sem virar ruído.

### O que implementar

#### 5.1. Adicionar scroll relevante
Registrar somente:
- mudanças grandes;
- scroll próximo de ação;
- com limiar de distância/tempo.

#### 5.2. Detectar abertura/fechamento de modal
Observar mudanças em diálogos visíveis e registrar como evento.

#### 5.3. Detectar troca de tabs/sections mais rica
Não depender só de `role=tab`.

#### 5.4. Melhorar summaries
Priorizar:
- `aria-label`
- texto visível
- `data-testid`
- labels humanas

#### 5.5. Refinar deduplicação
Ajustar throttles e ruído.

### Arquivos a tocar
- `extension/src/shared/interaction-timeline.ts`
- `extension/src/injected/page-bridge.ts`
- `extension/src/shared/context-limits.ts`

### Critérios de aceite
- timeline fica mais útil;
- ainda continua curta e legível;
- não registra interações da própria extensão.

---

## ETAPA 6 — Melhorar preview e consistência do snapshot

### Objetivo
Garantir que o preview mostre algo mais próximo do que será enviado.

### O que implementar

#### 6.1. Extrair builder de payload atual
Criar helper compartilhado para preview e submit.

#### 6.2. Refresh controlado do snapshot
Atualizar snapshot quando:
- abrir preview;
- houver nova request relevante;
- surgir erro relevante;
- houver nova ação importante.

#### 6.3. Indicador opcional de “contexto atualizado”
Opcional:
- timestamp
- botão “Atualizar contexto”

### Arquivos a tocar
- `extension/src/ui/FeedbackApp.tsx`
- novo: `extension/src/shared/build-current-issue-payload.ts`

### Critérios de aceite
- preview e submit usam a mesma base;
- menos chance de divergência;
- sem excesso de rerender.

---

## ETAPA 7 — Atualizar UX e comunicação da ferramenta

### Objetivo
Fazer a UI refletir melhor o poder real do produto.

### O que implementar

#### 7.1. Atualizar texto de “Incluir contexto técnico”
Novo texto deve refletir:
- rota e ambiente técnico;
- timeline;
- elemento relacionado;
- requests relevantes;
- runtime/performance;
- achados sensíveis, quando encontrados.

#### 7.2. Atualizar linguagem do preview
Deixar claro que:
- o sistema resume automaticamente contexto;
- anexos e HAR são apoio;
- achados sensíveis podem ser sinalizados.

#### 7.3. Remover menções de fase defasadas
Trocar “Phase 3” por algo neutro como:
- `Schema de contexto: v1`

#### 7.4. Melhorar UX de confiança
Mostrar quando:
- rede está sendo capturada;
- modo atual é debug interno ou produção sensível;
- achados sensíveis foram detectados.

### Arquivos a tocar
- `extension/src/ui/FeedbackApp.tsx`
- `extension/src/shared/issue-builder.ts`

### Critérios de aceite
- produto fica mais claro para QA;
- UI não fica para trás em relação ao código.

---

## ETAPA 8 — Preparar base para IA e classificação automática

### Objetivo
Deixar a arquitetura pronta para:
- título sugerido;
- resumo automático;
- severidade;
- labels;
- deduplicação futura.

### O que implementar

#### 8.1. Separar melhor contexto bruto e contexto para narrativa
Criar estruturas claras:
- contexto bruto;
- contexto resumido;
- output de issue.

#### 8.2. Criar helper de input para IA
Novo módulo:
- `extension/src/shared/ai-issue-input-builder.ts`

#### 8.3. Incluir findings de segurança no input
A IA futura deve receber:
- action principal
- request principal
- erro principal
- visual state
- app environment
- sensitive findings

#### 8.4. Não integrar IA agora
Só preparar a base.

### Arquivos a tocar
- `extension/src/shared/types.ts`
- `extension/src/shared/issue-builder.ts`
- `extension/src/shared/issue-narrative.ts`
- novo: `extension/src/shared/ai-issue-input-builder.ts`

### Critérios de aceite
- base pronta para IA;
- sem dependência externa;
- sem acoplamento prematuro.

---

# 6. Ordem recomendada de execução

Executar nesta ordem:

1. **Etapa 1 — Detecção de achados sensíveis**
2. **Etapa 2 — Modos operacionais de captura**
3. **Etapa 3 — Captura de ambiente da aplicação**
4. **Etapa 4 — Correlação entre sinais**
5. **Etapa 5 — Timeline mais rica**
6. **Etapa 6 — Preview consistente**
7. **Etapa 7 — UX e comunicação**
8. **Etapa 8 — Preparação para IA**

## Justificativa
- primeiro reforçar valor em segurança sem destruir contexto;
- depois adaptar comportamento ao ambiente real;
- em seguida aumentar reproduzibilidade e qualidade diagnóstica;
- por fim preparar UX e IA.

---

# 7. O que o Cursor deve evitar

- não endurecer sanitização de forma cega;
- não esconder sinais de **segredos, sessão, PII ou outros achados OWASP-relevantes** quando o problema é justamente **exposição** ou **misconfiguration** visível ao cliente;
- não imprimir segredos completos no corpo principal por padrão;
- não reduzir demais timeline, network summary e target DOM;
- não quebrar compatibilidade do contexto atual;
- não acoplar IA ainda;
- não transformar qualquer string estranha em achado de segurança sem critério.

---

# 8. Definição de pronto

Cada etapa só conta como pronta se:

## Técnico
- código funcionando sem regressão;
- builder da issue íntegro;
- tipagem consistente;
- integração com UI preservada.

## Funcional
- issue final fica melhor para dev;
- achados sensíveis aparecem de forma útil;
- contexto continua rico.

## Operacional
- modo default continua excelente para QA interno;
- produção sensível ganha mais controle sem matar diagnóstico.

---

# 9. Prompt sugerido para o Cursor

## Prompt
Implemente este plano por etapas sem degradar a capacidade de diagnóstico do QAFeedback.

Princípios obrigatórios:
1. Preserve o valor da captura atual.
2. Não endureça sanitização de forma cega.
3. Priorize detecção de achados sensíveis em vez de simplesmente esconder sinais importantes.
4. Mantenha o modo default orientado a debug interno.
5. Quando houver indício de dado sensível, destaque isso na issue de forma controlada.
6. Não imprimir segredos completos no corpo principal por padrão.
7. Toda nova captura deve passar por:
   - tipagem
   - normalização
   - builder da issue
   - integração com UI
8. Ao final de cada etapa:
   - explique o que mudou;
   - liste arquivos alterados;
   - descreva riscos;
   - explique como validar manualmente.

Comece pela Etapa 1 deste plano (**PRD-009**).

---

# 10. Checklist resumido

- [ ] Etapa 1 — Detecção de achados sensíveis
- [ ] Etapa 2 — Modos operacionais de captura
- [ ] Etapa 3 — Captura de ambiente da aplicação
- [ ] Etapa 4 — Correlação entre sinais
- [ ] Etapa 5 — Timeline mais rica
- [ ] Etapa 6 — Preview consistente
- [ ] Etapa 7 — UX e comunicação atualizadas
- [ ] Etapa 8 — Base preparada para IA
