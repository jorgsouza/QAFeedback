/**
 * Aplica máscara circular (alpha) ao capiQA.png para remover cantos quadrados /
 * artefatos tipo “quadriculado” e gera public/qa.png + public/icons/icon*.png
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const extRoot = join(__dirname, "..");
const repoRoot = join(extRoot, "..");
const src = join(repoRoot, "PRD", "capiQA.png");
const pub = join(extRoot, "public");
const icons = join(pub, "icons");

mkdirSync(icons, { recursive: true });

const meta = await sharp(src).metadata();
const w = meta.width ?? 0;
const h = meta.height ?? 0;
if (!w || !h) {
  console.error("roundify-capiqa: dimensões inválidas", src);
  process.exit(1);
}

const cx = w / 2;
const cy = h / 2;
/** Inscrita no retângulo; meio pixel para borda antialiased */
const r = Math.min(w, h) / 2 - 0.5;

const svgMask = Buffer.from(
  `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff"/>
  </svg>`,
);

const rounded = await sharp(src).ensureAlpha().composite([{ input: svgMask, blend: "dest-in" }]).png().toBuffer();

await sharp(rounded).resize(256, 256, { fit: "cover" }).png().toFile(join(pub, "qa.png"));

for (const z of [16, 32, 48, 128]) {
  await sharp(rounded).resize(z, z, { fit: "cover" }).png().toFile(join(icons, `icon${z}.png`));
}

console.log("roundify-capiqa: OK → public/qa.png + public/icons/");
