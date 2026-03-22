import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const manifestSrc = join(root, "manifest.dist.json");
const manifestDest = join(dist, "manifest.json");

if (!existsSync(dist)) {
  mkdirSync(dist, { recursive: true });
}
copyFileSync(manifestSrc, manifestDest);
