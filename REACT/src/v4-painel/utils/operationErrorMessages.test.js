import { describe, expect, it } from 'vitest';
import {
  OPERATION_DEFAULT_ERROR_MESSAGE,
  OPERATION_ERROR_MESSAGES,
  getOperationErrorPresentation,
} from './operationErrorMessages.js';

describe('getOperationErrorPresentation', () => {
  it.each(Object.entries(OPERATION_ERROR_MESSAGES))('mapeia %s para a mensagem amigavel correspondente (formato aninhado)', (code, entry) => {
    const error = { response: { data: { error: { code, field: 'someField' }, requestId: 'req-1' } } };

    const presentation = getOperationErrorPresentation(error);

    expect(presentation.code).toBe(code);
    expect(presentation.message).toBe(entry.message);
    expect(presentation.field).toBe(entry.field ?? 'someField');
    expect(presentation.fieldMessage).toBe(entry.fieldMessage ?? null);
    expect(presentation.requestId).toBe('req-1');
  });

  it('aceita formato flat legado (response.data.code / response.data.field)', () => {
    const error = { response: { data: { code: 'OPERATION_BOARD_NOT_FOUND', field: 'boardId', requestId: 'req-2' } } };

    const presentation = getOperationErrorPresentation(error);

    expect(presentation.code).toBe('OPERATION_BOARD_NOT_FOUND');
    expect(presentation.message).toBe(OPERATION_ERROR_MESSAGES.OPERATION_BOARD_NOT_FOUND.message);
    expect(presentation.field).toBe('plateId');
    expect(presentation.fieldMessage).toBe('Placa não encontrada.');
    expect(presentation.requestId).toBe('req-2');
  });

  it('aceita code/field/requestId atribuidos diretamente ao erro (wrapped pelo v4ServiceUtils)', () => {
    const error = { code: 'OPERATION_FINAL_REPORT_REQUIRED', field: 'finalReport', requestId: 'req-3' };

    const presentation = getOperationErrorPresentation(error);

    expect(presentation.code).toBe('OPERATION_FINAL_REPORT_REQUIRED');
    expect(presentation.message).toBe(OPERATION_ERROR_MESSAGES.OPERATION_FINAL_REPORT_REQUIRED.message);
    expect(presentation.field).toBe('finalReport');
    expect(presentation.fieldMessage).toBe('Relatório final é obrigatório.');
    expect(presentation.requestId).toBe('req-3');
  });

  it('retorna mensagem padrao quando o codigo nao esta mapeado', () => {
    const error = { response: { data: { error: { code: 'SOME_UNKNOWN_CODE' } } } };

    const presentation = getOperationErrorPresentation(error);

    expect(presentation.code).toBe('SOME_UNKNOWN_CODE');
    expect(presentation.message).toBe(OPERATION_DEFAULT_ERROR_MESSAGE);
    expect(presentation.field).toBeNull();
    expect(presentation.fieldMessage).toBeNull();
  });

  it('retorna mensagem padrao quando nao ha codigo de erro algum', () => {
    const presentation = getOperationErrorPresentation({});

    expect(presentation.code).toBeNull();
    expect(presentation.message).toBe(OPERATION_DEFAULT_ERROR_MESSAGE);
    expect(presentation.field).toBeNull();
    expect(presentation.fieldMessage).toBeNull();
    expect(presentation.requestId).toBeNull();
  });

  it('OPERATION_NOT_FOUND nao define field/fieldMessage (erro nao associado a campo)', () => {
    const error = { response: { data: { error: { code: 'OPERATION_NOT_FOUND' } } } };

    const presentation = getOperationErrorPresentation(error);

    expect(presentation.field).toBeNull();
    expect(presentation.fieldMessage).toBeNull();
  });
});
