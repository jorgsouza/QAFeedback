import { GoogleGenerativeAI } from "@google/generative-ai";
import { truncate } from "./sanitize.js";

const MAX_TITLE_OUT = 200;
const MAX_BODY_OUT = 50_000;

export type RefineInput = {
  geminiApiKey: string;
  model: string;
  whatHappened: string;
  technicalContextText: string;
  locale?: string;
};

export type RefineOutput = {
  title: string;
  body: string;
};

const SYSTEM_INSTRUCTION = `És um assistente para equipas de QA e desenvolvimento.
Recebes a descrição livre de um problema e, opcionalmente, contexto técnico (URL, consola, pedidos falhados, etc.).
Devolves APENAS um objeto JSON válido, sem markdown à volta, com as chaves exatas:
- "title": string curta para o título de uma issue no GitHub (clara, imperativa ou nominalizada; sem prefixos tipo "Bug:");
- "body": string em Markdown para o corpo da issue, com secção "## O que aconteceu" com o texto melhorado e, se o contexto técnico for útil, uma secção "## Contexto técnico" resumida (não repitas dados irrelevantes).
Responde no idioma do relatório (por defeito português europeu se ambíguo).`;

export async function refineWithGemini(input: RefineInput): Promise<RefineOutput> {
  const gen = new GoogleGenerativeAI(input.geminiApiKey);
  const model = gen.getGenerativeModel({
    model: input.model,
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
    },
  });

  const locale = input.locale?.trim() || "pt";
  const user = [
    `locale: ${locale}`,
    "",
    "## Descrição do QA",
    input.whatHappened,
    "",
    input.technicalContextText
      ? "## Contexto técnico bruto (pode estar truncado)\n" + input.technicalContextText
      : "(sem contexto técnico adicional)",
  ].join("\n");

  const res = await model.generateContent(user);
  const text = res.response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("gemini_invalid_json");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("gemini_invalid_shape");
  const rec = parsed as Record<string, unknown>;
  const title = typeof rec.title === "string" ? rec.title.trim() : "";
  const body = typeof rec.body === "string" ? rec.body.trim() : "";
  if (!title || !body) throw new Error("gemini_missing_fields");

  return {
    title: truncate(title, MAX_TITLE_OUT),
    body: truncate(body, MAX_BODY_OUT),
  };
}
