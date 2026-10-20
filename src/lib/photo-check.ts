// A quick, honest look at each photo as it is dropped, made in the browser from the same decode as its preview.
// Nothing here changes the file: it only tells the creative when a picture may disappoint the client.

// Pictures are measured at this size, so a 50-megapixel file costs no more to check than a phone photo.
export const CHECK_EDGE = 1024;

const TILE = 32;
// Below this, even the sharpest part of the picture is soft. Tuned on real photos and blurred copies of them: sharp
// photos scored 700 and up, a clearly blurred copy (a 2 px blur at check size) 7 to 105, a slight blur 85 and up.
export const BLURRY_BELOW = 80;
// Tiles flatter than this (sky, a plain background, the empty part of a logo) say nothing about focus.
const FLAT_BELOW = 6;
// With fewer tiles that have detail, the picture is a flat graphic and is not judged at all.
const MIN_TILES = 8;
const PRINT_PPI = 300;
const MM_PER_INCH = 25.4;

// Largest first, in millimetres.
const PAPER = [
  { name: "A3", short: 297, long: 420 },
  { name: "A4", short: 210, long: 297 },
  { name: "A5", short: 148, long: 210 },
  { name: "A6", short: 105, long: 148 },
];

// How sharp the sharpest parts of the picture are: the edge strength of each small tile, then a high percentile,
// so a portrait with a soft background still counts as sharp when the face is.
export function sharpness(gray: Float32Array, width: number, height: number): number {
  const tiles: number[] = [];
  for (let top = 1; top + TILE < height; top += TILE) {
    for (let left = 1; left + TILE < width; left += TILE) {
      let sum = 0;
      let squares = 0;
      let light = 0;
      let lightSquares = 0;
      let count = 0;
      for (let y = top; y < top + TILE; y++) {
        for (let x = left; x < left + TILE; x++) {
          const at = y * width + x;
          const edge = 4 * gray[at] - gray[at - 1] - gray[at + 1] - gray[at - width] - gray[at + width];
          sum += edge;
          squares += edge * edge;
          light += gray[at];
          lightSquares += gray[at] * gray[at];
          count++;
        }
      }
      const lightMean = light / count;
      if (Math.sqrt(Math.max(0, lightSquares / count - lightMean * lightMean)) < FLAT_BELOW) continue;
      const mean = sum / count;
      tiles.push(squares / count - mean * mean);
    }
  }
  if (tiles.length < MIN_TILES) return Infinity;
  tiles.sort((a, b) => a - b);
  return tiles[Math.floor(tiles.length * 0.9)];
}

// The biggest paper size the picture prints sharply on, or null when it is too small even for A6.
export function largestPrint(width: number, height: number): string | null {
  const short = (Math.min(width, height) / PRINT_PPI) * MM_PER_INCH;
  const long = (Math.max(width, height) / PRINT_PPI) * MM_PER_INCH;
  return PAPER.find((paper) => short >= paper.short && long >= paper.long)?.name ?? null;
}

// Plain-language notes for one picture; none means it looks fine. Print size is only judged for camera and print
// formats: a PNG or WebP is usually made for a screen, where its size is deliberate.
export function photoNotes(type: string, width: number, height: number, sharpnessScore: number): string[] {
  const notes: string[] = [];
  if (sharpnessScore < BLURRY_BELOW) notes.push("Looks blurry. Check it is the right version before you send it.");
  if (type !== "image/jpeg" && type !== "image/tiff") return notes;
  const print = largestPrint(width, height);
  if (print === null) notes.push(`Small (${width} × ${height}). Fine on a phone, too small to print sharply.`);
  else if (print === "A6" || print === "A5") notes.push(`Small (${width} × ${height}). Prints sharply up to ${print}.`);
  return notes;
}

// Reads a canvas already drawn at check size into brightness values.
export function grayFrom(data: Uint8ClampedArray, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  return gray;
}
