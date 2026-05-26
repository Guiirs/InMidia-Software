/**
 * CNPJ Validator utility
 */

/**
 * Validates a Brazilian CNPJ number
 * @param cnpj - CNPJ to validate (may contain dots, slashes, and dashes)
 * @returns true if CNPJ is valid, false otherwise
 */
export function validarCNPJ(cnpj: string): boolean {
  if (!cnpj) return false;

  // Remove special characters
  const cnpjLimpo = cnpj.replace(/[^\d]+/g, '');

  // Check if it has 14 digits
  if (cnpjLimpo.length !== 14) return false;

  // Eliminate known invalid CNPJs (all digits the same)
  if (/^(\d)\1+$/.test(cnpjLimpo)) return false;

  // Validation of check digits
  let tamanho = cnpjLimpo.length - 2;
  let numeros = cnpjLimpo.substring(0, tamanho);
  const digitos = cnpjLimpo.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado != parseInt(digitos.charAt(0))) return false;

  tamanho = tamanho + 1;
  numeros = cnpjLimpo.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado != parseInt(digitos.charAt(1))) return false;

  return true;
}

/**
 * Validates a Brazilian CPF number
 * @param cpf - CPF to validate (may contain dots and dashes)
 * @returns true if CPF is valid, false otherwise
 */
export function validarCPF(cpf: string): boolean {
  if (!cpf) return false;

  // Remove special characters
  const cpfLimpo = cpf.replace(/[^\d]+/g, '');

  // Check if it has 11 digits
  if (cpfLimpo.length !== 11) return false;

  // Eliminate known invalid CPFs
  if (/^(\d)\1+$/.test(cpfLimpo)) return false;

  // Validation of check digits
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpfLimpo.charAt(i)) * (10 - i);
  }

  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpfLimpo.charAt(9))) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpfLimpo.charAt(i)) * (11 - i);
  }

  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpfLimpo.charAt(10))) return false;

  return true;
}

/**
 * Formats CNPJ for display
 * @param cnpj - CNPJ string
 * @returns Formatted CNPJ (XX.XXX.XXX/XXXX-XX)
 */
export function formatCNPJ(cnpj: string): string {
  const cnpjLimpo = cnpj.replace(/[^\d]+/g, '');
  if (cnpjLimpo.length !== 14) return cnpj;

  return cnpjLimpo.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

/**
 * Formats CPF for display
 * @param cpf - CPF string
 * @returns Formatted CPF (XXX.XXX.XXX-XX)
 */
export function formatCPF(cpf: string): string {
  const cpfLimpo = cpf.replace(/[^\d]+/g, '');
  if (cpfLimpo.length !== 11) return cpf;

  return cpfLimpo.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}
