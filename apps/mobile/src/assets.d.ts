// Font files bundled by Metro: importing one gives its asset id (S1-04, the iOS Baloo copies).
declare module '*.ttf' {
  const asset: number;
  export default asset;
}
