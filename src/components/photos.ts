// Photos shown inside the landing page mockups. `focus` is the object-position that keeps the face in frame
// when a portrait shot is cropped to a landscape thumbnail.
export const photos = {
  printLaugh: { src: "/images/mock/print-laugh.webp", focus: "50% 27%" },
  printSmile: { src: "/images/mock/print-smile.webp", focus: "50% 27%" },
  capFists: { src: "/images/mock/cap-fists.webp", focus: "50% 12%" },
  purplePhone: { src: "/images/mock/purple-phone.webp", focus: "50% 0%" },
  beretPhone: { src: "/images/mock/beret-phone.webp", focus: "50% 15%" },
  limePhone: { src: "/images/mock/lime-phone.webp", focus: "50% 10%" },
  faceSculpture: { src: "/images/mock/face-sculpture.webp", focus: "50% 30%" },
  lensBefore: { src: "/images/mock/lens-before.webp", focus: "60% 25%" },
  lensAfter: { src: "/images/mock/lens-after.webp", focus: "60% 25%" },
  headphones: { src: "/images/mock/headphones-illustration.webp", focus: "70% 12%" },
} as const;

export type PhotoKey = keyof typeof photos;
