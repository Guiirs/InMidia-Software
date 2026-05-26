// utils/validator.js

// --- Funções Básicas de Validação ---
export const isNotEmpty = (value) => value !== null && value !== undefined && String(value).trim() !== '';
export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
export const minLength = (value, length) => typeof value === 'string' && value.length >= length;
export const maxLength = (value, length) => typeof value === 'string' && value.length <= length; // <<< NOVA: Máximo comprimento
export const areEqual = (value1, value2) => value1 === value2;
export const validatePassword = (password) => minLength(password, 6); // Alias

// --- Validações Específicas ---

/**
 * Valida um CNPJ completo (formato, dígitos repetidos e dígitos verificadores).
 * Implementa o algoritmo oficial de validação de CNPJ usando módulo 11.
 * @param {string} cnpj - O CNPJ a validar.
 * @returns {boolean} - True se o CNPJ for matematicamente válido.
 */
export const validateCNPJ = (cnpj) => {
    if (!cnpj) return false;
    const cleaned = String(cnpj).replace(/[^\d]/g, ''); // Remove formatação

    // Verifica tamanho
    if (cleaned.length !== 14) return false;

    // Verifica se todos os dígitos são iguais (ex: 00.000.000/0000-00) - CNPJs inválidos
    if (/^(\d)\1+$/.test(cleaned)) return false;

    // Validação dos dígitos verificadores (algoritmo oficial)
    let tamanho = cleaned.length - 2;
    let numeros = cleaned.substring(0, tamanho);
    const digitos = cleaned.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;

    // Calcula o primeiro dígito verificador
    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }
    let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado != digitos.charAt(0)) return false;

    // Calcula o segundo dígito verificador
    tamanho = tamanho + 1;
    numeros = cleaned.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }
    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado != digitos.charAt(1)) return false;

    return true;
};

/**
 * Valida formato de coordenadas (ex: "-3.12345, -38.54321").
 * @param {string} coords - String das coordenadas.
 * @returns {boolean} - True se o formato for válido.
 */
export const validateCoordinates = (coords) => {
    if (!coords) return false;
    // Regex: Opcional '-', dígitos, opcional '.', dígitos, ',', opcional espaço, opcional '-', dígitos, opcional '.', dígitos
    const regex = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;
    return regex.test(String(coords).trim());
};


/**
 * Valida se o valor é uma URL válida.
 * @param {string} value - O valor a verificar.
 * @returns {boolean} - True se for uma URL válida.
 */
export const isURL = (value) => {
     if (!value) return false; // Trata strings vazias
     try {
         // Tenta criar um objeto URL. Se for inválido, lança erro.
         // Adiciona um protocolo padrão se não houver, pois o construtor exige.
         const urlString = String(value);
         if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
             // Tenta adicionar https:// como padrão para validação, mas não altera o valor original
             new URL(`https://${urlString}`);
         } else {
             new URL(urlString);
         }
         return true;
     } catch (_) {
         return false; // Lançou erro, URL inválida
     }
};

// --- Função Principal de Validação de Formulário ---

/**
 * Valida um formulário com base nas regras fornecidas e exibe erros.
 * @param {HTMLFormElement | null} formElement - O elemento do formulário.
 * @param {object} rules - Objeto com regras por nome de campo. Ex: { fieldName: [{ type: 'required', message: 'Custom msg'}, {type: 'minLength', param: 5}] }
 * @returns {{isValid: boolean, errors: object}} - Resultado da validação.
 */
export function validateForm(formElement, rules) {
    const errors = {};
    let formIsValid = true;

    // Verifica se formElement é válido
    if (!formElement || !(formElement instanceof HTMLFormElement)) {
        console.error("[validateForm] Elemento de formulário inválido fornecido.");
        return { isValid: false, errors: { form: 'Erro interno na validação.' } };
    }

    const errorMsgClass = 'modal-form__error-message';
    const inputErrorClass = 'input-error';

    // Limpa erros antigos da UI
    formElement.querySelectorAll(`.${errorMsgClass}`).forEach(el => el.textContent = '');
    formElement.querySelectorAll(`.${inputErrorClass}`).forEach(el => el.classList.remove(inputErrorClass));

    for (const fieldName in rules) {
        // Tenta encontrar o elemento pelo atributo 'name'
        const inputElement = formElement.querySelector(`[name="${fieldName}"]`);
        // Se não encontrar, regista um aviso mas continua (pode ser intencional)
        if (!inputElement) {
            console.warn(`[validateForm] Elemento não encontrado para o campo: ${fieldName}`);
            continue;
        }

        const value = inputElement.value;
        const fieldRules = rules[fieldName] || []; // Garante que é um array
        let fieldIsValid = true; // Flag para parar no primeiro erro do campo

        // Encontra o elemento de erro associado
        const errorElement = formElement.querySelector(`[data-for="${fieldName}"]`);

        // Verifica se o campo é opcional e vazio
        const isOptional = fieldRules.some(rule => rule.type === 'optional');
        if (isOptional && !isNotEmpty(value)) {
            // Limpa erro (caso tenha sido marcado antes e agora esteja vazio e opcional)
             if (errorElement) errorElement.textContent = '';
             inputElement.classList.remove(inputErrorClass);
            continue; // Pula para o próximo campo
        }

        // Itera sobre as regras do campo
        for (const rule of fieldRules) {
            if (!fieldIsValid) break; // Já falhou neste campo

            let isValidForRule = true;
            let errorMessage = rule.message || 'Valor inválido.'; // Mensagem padrão ou customizada

            try {
                switch (rule.type) {
                    case 'required':
                        isValidForRule = isNotEmpty(value);
                        errorMessage = rule.message || 'Este campo é obrigatório.';
                        break;
                    case 'email':
                        isValidForRule = isEmail(value);
                        errorMessage = rule.message || 'Por favor, insira um email válido.';
                        break;
                    case 'minLength':
                        isValidForRule = minLength(value, rule.param);
                        errorMessage = rule.message || `Deve ter no mínimo ${rule.param} caracteres.`;
                        break;
                    case 'maxLength': // <<< NOVA REGRA
                        isValidForRule = maxLength(value, rule.param);
                        errorMessage = rule.message || `Deve ter no máximo ${rule.param} caracteres.`;
                        break;
                    case 'equalTo': {
                        const otherElement = formElement.querySelector(`[name="${rule.param}"]`);
                        isValidForRule = otherElement ? areEqual(value, otherElement.value) : false;
                        errorMessage = rule.message || 'Os valores não coincidem.';
                        break;
                    }
                    case 'custom':
                        if (typeof rule.validate === 'function') {
                            try {
                                isValidForRule = rule.validate(value);
                                if (isValidForRule !== true) {
                                     isValidForRule = false;
                                     errorMessage = rule.message || 'Valor inválido (custom).';
                                }
                            } catch (customError) {
                                isValidForRule = false;
                                errorMessage = customError.message || rule.message || 'Erro na validação customizada.';
                            }
                        } else { /* ... erro configuração ... */ }
                        break;
                    case 'regex':
                        if (rule.param instanceof RegExp) {
                            isValidForRule = rule.param.test(value);
                            errorMessage = rule.message || 'Formato inválido.';
                        } else { /* ... erro configuração ... */ }
                        break;
                    case 'url':
                        // Permite URL vazia se for opcional, senão valida
                        isValidForRule = (!isNotEmpty(value) && isOptional) || isURL(value);
                        errorMessage = rule.message || 'URL inválida.';
                        break;
                    case 'coords': // <<< NOVA REGRA
                        // Permite vazio se opcional, senão valida formato
                        isValidForRule = (!isNotEmpty(value) && isOptional) || validateCoordinates(value);
                        errorMessage = rule.message || 'Formato de coordenadas inválido (ex: -3.12, -38.45).';
                        break;
                    case 'cnpj': // <<< NOVA REGRA (usa função específica)
                         // Permite vazio se opcional, senão valida formato
                         isValidForRule = (!isNotEmpty(value) && isOptional) || validateCNPJ(value);
                         errorMessage = rule.message || 'CNPJ inválido (verifique formato e dígitos).';
                         break;
                    case 'optional':
                        // Já tratado no início do loop do campo
                        isValidForRule = true;
                        break;
                    default:
                        console.warn(`[validateForm] Tipo de regra desconhecido: ${rule.type}`);
                        isValidForRule = false; // Regra desconhecida falha
                        errorMessage = `Regra desconhecida: ${rule.type}`;
                }
            } catch (validationError) {
                console.error(`[validateForm] Erro ao validar campo ${fieldName} com regra ${rule.type}:`, validationError);
                isValidForRule = false;
                errorMessage = 'Erro inesperado durante a validação.';
            }

            // Se a regra falhou
            if (!isValidForRule) {
                errors[fieldName] = errorMessage;
                formIsValid = false;
                fieldIsValid = false; // Marca que este campo falhou

                // Exibe o erro na UI
                if (errorElement) {
                    errorElement.textContent = errorMessage;
                } else {
                    console.warn(`[validateForm] Elemento de erro [data-for="${fieldName}"] não encontrado.`);
                }
                inputElement.classList.add(inputErrorClass);
            }
        } // Fim loop regras

         // Se o campo passou em TODAS as regras, garante que não há erro visível
         if (fieldIsValid) {
             if (errorElement) errorElement.textContent = '';
             inputElement.classList.remove(inputErrorClass);
         }
    } // Fim loop campos

    return {
        isValid: formIsValid,
        errors: errors,
    };
}
