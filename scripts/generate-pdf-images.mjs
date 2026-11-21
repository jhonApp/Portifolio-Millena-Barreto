// Builds the light copies of the style images used inside the diagnosis PDF (RF-07).
// The originals in public/assets/diagnostic/ are for the result screen and some are over 2 MB, while the
// PDF (stored in a bucket limited to 2 MB and attached to an e-mail) embeds two of them. Each copy is a
// JPEG of at most 800 x 1360 pixels. Run: node scripts/generate-pdf-images.mjs
import sharp from "sharp";
import { mkdirSync, statSync } from "node:fs";

const SOURCES = {
  esportivo_natural: "esportivo.jpg",
  tradicional: "tradicional.jpg",
  elegante: "elegante.jpg",
  romantico: "romantico.png",
  criativo: "criativo.jpg",
  dramatico: "dramatico.png",
};

mkdirSync("assets/pdf-images", { recursive: true });
for (const [style, file] of Object.entries(SOURCES)) {
  const out = `assets/pdf-images/${style}.jpg`;
  await sharp(`public/assets/diagnostic/${file}`)
    .resize({ width: 800, height: 1360, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(out);
  console.log(out, Math.round(statSync(out).size / 1024), "KB");
}
