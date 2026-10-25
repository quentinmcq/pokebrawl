/** `Électrik` → `electrik`: for comparing names and building addresses whatever their accents. */
export const withoutDiacritics = (text: string) =>
  text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase()
