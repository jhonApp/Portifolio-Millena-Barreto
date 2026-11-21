// Builds the light copies of the style images used inside the diagnosis PDF (RF-07).
// The originals in public/assets/diagnostic/ are for the result screen and some are over 2 MB, while the
// PDF (stored in a bucket limited to 2 MB and attached to an e-mail) embeds two of them. Each copy is a
// JPEG of at most 800 x 1360 pixels. Run: node scripts/generate-pdf-images.mjs
import sharp from "sharp";
import { existsSync, mkdirSync, statSync } from "node:fs";

const SOURCES = {
  esportivo_natural: "esportivo.jpg",
  tradicional: "tradicional.jpg",
  elegante: "elegante.jpg",
  romantico: "romantico.png",
  criativo: "criativo.jpg",
  dramatico: "dramatico.png",
};

const SLOTS = ["pecas", "acessorios"];

// The slots (<style>-pecas.jpg, <style>-acessorios.jpg) are photos of pieces and accessories the owner has
// not sent yet: a slot whose source file does not exist is skipped, and the PDF renders without it.
const jobs = Object.entries(SOURCES).map(([style, file]) => ({ out: style, source: file }));
for (const style of Object.keys(SOURCES)) {
  for (const slot of SLOTS) jobs.push({ out: `${style}-${slot}`, source: `${style}-${slot}.jpg` });
}

mkdirSync("assets/pdf-images", { recursive: true });
for (const { out: name, source } of jobs) {
  if (!existsSync(`public/assets/diagnostic/${source}`)) continue;
  const out = `assets/pdf-images/${name}.jpg`;
  await sharp(`public/assets/diagnostic/${source}`)
    .resize({ width: 800, height: 1360, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(out);
  console.log(out, Math.round(statSync(out).size / 1024), "KB");
}
