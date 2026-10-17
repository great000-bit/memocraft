// How a creative's studio appears on their client pages. Safe to import from client components.

// What a client page needs to put the creative's name first. "logoSrc" is null when there is no logo.
export type Brand = {
  name: string | null;
  logoSrc: string | null;
  logoWidth: number;
  logoHeight: number;
};

export const noBrand: Brand = { name: null, logoSrc: null, logoWidth: 0, logoHeight: 0 };

// The browser shrinks a logo to fit this box and sends it as a PNG, which keeps a transparent background. The
// client page shows it at most 56 px tall, so 240 px leaves room for sharp screens.
export const logoRules = { maxWidth: 960, maxHeight: 240, maxBytes: 900 * 1024, nameMax: 80 } as const;

// A logo's size on the page: as tall as the header allows, unless that makes a wide logo too wide.
export function logoBox(brand: Brand, height: number, maxWidth: number): { width: number; height: number } {
  if (!brand.logoWidth || !brand.logoHeight) return { width: height, height };
  const scale = Math.min(height / brand.logoHeight, maxWidth / brand.logoWidth);
  return { width: Math.round(brand.logoWidth * scale), height: Math.round(brand.logoHeight * scale) };
}
