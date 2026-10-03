/**
 * The teachers' CC BY 4.0 credits for the landing, which shows them live and in its stills (V8.3c: both, the reader
 * picks one). Copies of `AVATAR_ASSETS.<teacher>.credit` (Teacher.tsx) rather than imports, because importing Teacher
 * would put three.js in the landing's first load; `credit.test.ts` keeps them equal.
 */
const CANINO3D = {
  author: "Canino3d",
  authorUrl: "https://sketchfab.com/Canino3d",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  modified: true,
} as const;

export const JAKE_CREDIT = {
  title: "Free Cartoon Game Man Character (Rigged)",
  sourceUrl: "https://sketchfab.com/3d-models/free-cartoon-game-man-character-rigged-a69c8962f4a14ea89bf623d716a81411",
  ...CANINO3D,
} as const;

export const MJ_CREDIT = {
  title: "Free Stylized Cartoon Girl Rigged Character",
  sourceUrl: "https://sketchfab.com/3d-models/free-stylized-cartoon-girl-rigged-character-dcaa822909ae4e04ad7eb85bc371a8c4",
  ...CANINO3D,
} as const;

export const TEACHER_CREDITS = [JAKE_CREDIT, MJ_CREDIT] as const;
