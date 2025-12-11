/// <reference types="vite/client" />

// CRXJS script import declarations
declare module "*?script" {
  const scriptUrl: string;
  export default scriptUrl;
}
