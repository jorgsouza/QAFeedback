/**
 * Lê PRD/capiQA.png: remove margens transparentes, preenche um quadrado com fit cover
 * (mascote o maior possível dentro do círculo do manifest — Chrome não aumenta o slot da toolbar)
 * e gera public/qa.png (64×64) + icons/icon*.png
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

/** Recorta alpha baixo e encolhe canvas ao conteúdo (arte ocupa mais pixels no ícone final). */
const trimmedBuf = await sharp(src)
  .ensureAlpha()
  .trim({ threshold: 2 })
  .png()
  .toBuffer();

const meta = await sharp(trimmedBuf).metadata();
const w = meta.width ?? 0;
const h = meta.height ?? 0;
if (!w || !h) {
  console.error("roundify-capiqa: dimensões inválidas", src);
  process.exit(1);
}

/** Quadrado: cover preenche o quadrado; a máscara circular corta só os cantos (máximo tamanho aparente). */
const side = Math.max(w, h);

const squared = await sharp(trimmedBuf)
  .resize(side, side, { fit: "cover", position: "centre" })
  .png()
  .toBuffer();

const cx = side / 2;
const cy = side / 2;
const r = side / 2 - 0.5;

const svgMask = Buffer.from(
  `<svg width="${side}" height="${side}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff"/>
  </svg>`,
);

const rounded = await sharp(squared).composite([{ input: svgMask, blend: "dest-in" }]).png().toBuffer();

/** Arte alinhada ao Figma (64×64); na UI o CSS mostra a 40×40. */
const QA_PX = 64;
await sharp(rounded).resize(QA_PX, QA_PX, { fit: "cover" }).png().toFile(join(pub, "qa.png"));

for (const z of [16, 32, 48, 128]) {
  await sharp(rounded).resize(z, z, { fit: "cover" }).png().toFile(join(icons, `icon${z}.png`));
}

console.log("roundify-capiqa: OK → public/qa.png + public/icons/");
