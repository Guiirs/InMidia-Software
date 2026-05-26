/**
 * Tipos mínimos para qrcode-terminal.
 * O pacote não tem @types — apenas o shape usado no projeto está declarado.
 */
declare module 'qrcode-terminal' {
  interface GenerateOptions {
    small?: boolean;
  }
  function generate(qrCode: string, options?: GenerateOptions): void;
  export = { generate };
}
