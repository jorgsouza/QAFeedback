# Serviço `ia-feedback` (Fase 1 do plano)

API HTTP mínima para a extensão **QAFeedback**: gera **título** e **corpo** (Markdown) de uma issue a partir da descrição do QA e contexto técnico opcional, usando **Google Gemini**.

## Pré-requisitos

- Node.js 18+
- Ficheiro **`.env` na raiz do repositório** `QAFeedback` (não versionado), com pelo menos:

| Variável | Descrição |
|----------|-----------|
| `GEMINI_API_KEY` | Chave da API Google AI (Gemini). |
| `GEMINI_MODEL` | Opcional; padrão `gemini-2.0-flash`. |
| `IA_FEEDBACK_API_KEY` | Segredo partilhado: a extensão envia `Authorization: Bearer <valor>` (ou `X-Api-Key`). **Não** é a mesma chave que `GEMINI_API_KEY`. |
| `PORT` | Opcional; padrão **8787**. |

Ver também [`.env.example`](../../.env.example) na raiz.

**Nota:** linhas no `.env` devem ser `CHAVE=valor` sem espaços à esquerda do nome da chave; caso contrário o `dotenv` pode ignorá-las.

## Arranque

```bash
cd services/ia-feedback
npm install
npm run dev
```

Servidor em `http://127.0.0.1:8787` (ou `PORT`).

## Endpoints

- **`GET /health`** ou **`GET /v1/health`** — JSON com `ok`, `geminiConfigured`, `clientAuthConfigured`. **503** se faltar Gemini ou `IA_FEEDBACK_API_KEY`.
- **`POST /v1/refine-issue`** — cabeçalho **`Authorization: Bearer <IA_FEEDBACK_API_KEY>`** (ou `X-Api-Key`). Corpo JSON:

```json
{
  "whatHappened": "texto obrigatório",
  "technicalContext": { },
  "locale": "pt"
}
```

Resposta **200:** `{ "title": "...", "body": "..." }` (Markdown).

## Exemplo `curl`

```bash
export IA_KEY='o-mesmo-valor-de-IA_FEEDBACK_API_KEY-no-env'

curl -sS http://127.0.0.1:8787/health

curl -sS -X POST http://127.0.0.1:8787/v1/refine-issue \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $IA_KEY" \
  -d '{"whatHappened":"O botão Salvar não responde no formulário de login.","locale":"pt"}'
```

## Testes

```bash
npm test
```

## Deploy futuro

O plano prevê **Cloud Run** (ou equivalente): definir as mesmas variáveis no ambiente, **HTTPS** obrigatório, e restringir CORS se deixares de usar `*`.
