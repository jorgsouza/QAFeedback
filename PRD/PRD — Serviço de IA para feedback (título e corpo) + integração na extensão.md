# PRD — Serviço de IA para feedback (título e corpo) + integração na extensão

> **Produto:** QAFeedback (extensão Chrome MV3)  
> **Branch de trabalho:** `feature/feedback-ia-backend`  
> **Estado:** especificação para implementação após *grill-me* com o utilizador

---

## 1. Nome da funcionalidade

**Serviço de IA opcional para gerar título e refinar o texto da issue**, com fallback local quando o serviço estiver indisponível ou desconfigurado.

---

## 2. Contexto e problema

Hoje o QA preenche **título** e **“O que aconteceu”** e a extensão cria a issue no GitHub com contexto técnico opcional. O objetivo é **reduzir fricção**: o QA foca na descrição; o **título** e **ajustes de texto** podem ser produzidos por um modelo (ex. Gemini), usando o mesmo conjunto de dados que já entram na issue (texto + consola / requests falhados / URL / viewport / elemento, quando o checkbox de contexto técnico estiver ativo).

Sem serviço de IA, o comportamento atual de **criar issue no GitHub** deve manter-se **equivalente em resultado**, à exceção do facto de o título deixar de ser manual e passar a ser **derivado** (fallback).

---

## 3. Objetivos

1. **Opcionalidade:** Se não houver URL base do serviço configurada, ou o serviço falhar (rede, 5xx, timeout, 401), a extensão **continua a criar issues** sem bloquear o fluxo.
2. **Pipeline único:** Ao clicar **“Criar issue”**, a extensão: valida descrição obrigatória → (tenta IA com timeout) → aplica **teto de caracteres no título** → cria a issue no GitHub **sem passo extra** de confirmação obrigatória.
3. **Transparência:** Indicador visual **IA** (verde = último health OK; vermelho = indisponível / não configurado / última falha), com **health check** ao abrir o modal e **retry** ao interagir com o indicador.
4. **Segurança em fase 1:** Autenticação do cliente ao backend com **API key / token estático** guardado nas opções da extensão (como o PAT do GitHub). **Login OTP por email** fica **fora** deste PRD (fase futura).
5. **Privacidade e limites:** Enviar ao modelo apenas o que hoje compõe a issue relevante (texto do QA + dados de contexto técnico quando marcado), com **truncamento** alinhado ao `issue-builder` e **remoção simples** de padrões sensíveis no servidor (ex. `Bearer`, `password=`) antes de chamar o modelo.

---

## 4. Fora de âmbito (fases futuras)

- Autenticação **OTP** por email da empresa.
- **Jira** ou outros destinos além do GitHub.
- **Ditado** por voz e transcrição pela IA ao guardar (pode implicar repensar o separador Preview).
- Proxy de criação de issues (GitHub continua a ser chamado a partir da extensão com o token atual).

---

## 5. Utilizadores e histórias de utilizador

| ID | História |
|----|----------|
| US1 | Como **QA**, quero **só escrever a descrição** do problema para não perder tempo a inventar títulos curtos. |
| US2 | Como **QA**, quero que a extensão **crie a issue no GitHub** mesmo quando o **serviço de IA está offline**, para não ficar bloqueado. |
| US3 | Como **QA**, quero **ver no Preview** o título que será usado e o corpo em Markdown **antes ou depois** do envio (conforme implementação do preview existente), com possibilidade de **editar o título no Preview** quando consulto esse separador antes de criar. |
| US4 | Como **administrador da extensão**, quero configurar **URL base do serviço de IA** e **API key** nas opções, separadas de **Domínios permitidos** (sites onde o botão aparece). |
| US5 | Como **equipa**, quero poder **testar o backend localmente** (`http://127.0.0.1:8080`) antes de publicar em **Cloud Run** (ou equivalente). |

**Nota (US3):** O fluxo principal acordado é **envio direto** após IA ou fallback, **sem** diálogo obrigatório de confirmação. O Preview continua como ferramenta de revisão **opcional**; o título no Preview é **editável** quando o utilizador usa esse separador antes de **Criar issue**.

---

## 6. Requisitos funcionais

### 6.1 Extensão — formulário

- **RF1:** Remover o campo **“Título”** do separador Formulário.
- **RF2:** Manter **“O que aconteceu”** **obrigatório**; não permitir envio se estiver vazio.
- **RF3:** Ao **“Criar issue”**:  
  - Se IA **disponível** (URL + key configurados e health recente / chamada bem-sucedida): chamar o backend com texto + contexto técnico serializado conforme política de truncamento; receber **título** e **corpo refinado** (ou só título + descrição — ver contrato API §8).  
  - Se IA **indisponível** ou **erro/timeout**: **título** = primeiras **6 palavras** da descrição após `trim`, onde **palavra** = token separado por **espaços** (ex.: `não,isto` conta como **uma** palavra).  
  - Aplicar **teto máximo de caracteres** ao título no cliente (valor alvo: ~**120–200**, com elipse se necessário), tanto para resposta IA como para fallback.
- **RF4:** O **corpo** da issue no GitHub deve refletir o texto refinado pela IA quando esta for usada com sucesso; caso contrário, manter a composição atual (`issue-builder`) com a descrição original do QA.
- **RF5:** Indicador **IA** (bolinha verde/vermelha) no modal; **GET /health** (ou equivalente) ao **abrir** o modal; **retry** ao clicar no indicador (ou controlo associado).
- **RF6:** Mensagens de erro **401** da API de IA devem sugerir **configuração incorreta** (key ou URL), sem expor segredos.

### 6.2 Opções da extensão

- **RF7:** Novos campos (opcionais): **URL base do serviço de IA** (ex. `https://ia-feedback.empresa.com`, ou `http://127.0.0.1:8080` em desenvolvimento) e **API key** do serviço.  
- **RF8:** **Domínios permitidos** mantém o comportamento atual (um hostname por linha); **não** reutilizar esta lista como URL da API de IA.

### 6.3 Backend (serviço de IA)

- **RF9:** Expor **`GET /health`** (ou `/v1/health`) retornando **200** quando o processo e a configuração mínima (ex. chave Gemini em variável de ambiente) estiverem OK.
- **RF10:** Expor **`POST /v1/refine-issue`** (nome final pode variar) que: valida **API key** (header ou `Authorization: Bearer` — a documentar na implementação); aplica truncamento + strip mínimo; chama **Gemini** (ou modelo configurável); devolve JSON com **title** e **body** (markdown ou texto alinhado ao corpo da issue).
- **RF11:** Timeout recomendado no cliente ao chamar o refine; em timeout, cair no **fallback** das 6 palavras e fluxo GitHub normal.

---

## 7. Requisitos não funcionais

- **RNF1:** Latência: o utilizador deve ver estado de **carregamento** durante a chamada à IA no **“Criar issue”** (ex. botão desabilitado + texto “A preparar…”).
- **RNF2:** Não registar API keys ou PAT em logs do servidor em claro.
- **RNF3:** Repositório backend inicialmente **runnável em local**; documentar variáveis de ambiente e comando de arranque.
- **RNF4:** Extensão: chamadas HTTP à API de IA devem passar pelo **service worker** (ou caminho já aprovado no projeto) para não expor a API key na página alvo.

---

## 8. Contrato da API (rascunho para implementação)

**Headers:** `Authorization: Bearer <api_key>` ou `X-Api-Key: <api_key>` (uma convenção única documentada).

**POST /v1/refine-issue**

- **Entrada (JSON):**  
  - `whatHappened` (string, obrigatório)  
  - `technicalContext` (objeto opcional, mesmo formato lógico que `TechnicalContextPayload` ou subconjunto serializado texto/JSON limitado)  
  - `locale` (opcional, ex. `pt`)
- **Saída (JSON):**  
  - `title` (string)  
  - `body` (string, markdown do corpo principal da issue, alinhado às secções atuais — ex. “O que aconteceu” + blocos de contexto se aplicável)

**Erros:** `401` inválido; `503` indisponível; `400` payload inválido.

---

## 9. Critérios de sucesso

- Com **URL + key vazios**, comportamento equivalente ao atual **menos** campo de título manual: issues criadas com título fallback quando a descrição existe.
- Com **serviço ativo**, títulos mais consistentes e corpo melhor estruturado na maioria dos casos de teste manuais definidos na implementação.
- **Nenhum** bloqueio permanente de criação de issue por falha da IA.
- Documentação de **setup local** do backend e de **opções** da extensão atualizada.

---

## 10. Dependências e riscos

- **Manifest / permissões:** URL HTTPS da empresa pode exigir **optional host permission** ou padrão já coberto por `optional_host_permissions` — validar na implementação.
- **Custos** de API do modelo e **quotas**.
- **Conteúdo sensível** na consola: o QA mantém controlo via checkbox de contexto técnico; documentar boas práticas.

---

## 11. Referências no código atual

- Corpo da issue: `extension/src/shared/issue-builder.ts`  
- Payload e settings: `extension/src/shared/types.ts`, `extension/src/shared/storage.ts`  
- Fluxo de criação: `extension/src/ui/FeedbackApp.tsx`, `extension/src/background/service-worker.ts`  
- Permissões de rede: `extension/manifest.dist.json`
