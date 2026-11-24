import type { Style } from "./constants";

// Where the light copy of each style image sits inside assets/pdf-images/. The owner's images are
// grouped in one folder per style (looks, accessories), so the path is not always <style>.jpg.
// Safe to import in the browser and on the server; it only holds names.
export const PDF_IMAGE_FILES: Record<Style, string> = {
  esportivo_natural: "esportivo/esportivo_natural.jpg",
  tradicional: "tradicional/looks/tradicional.jpg",
  elegante: "elegante.jpg",
  romantico: "romantico/looks/romantico.jpg",
  criativo: "criativo/looks/criativo.jpg",
  dramatico: "dramatico.jpg",
};
