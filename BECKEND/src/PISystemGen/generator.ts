import Contrato from '../modules/contratos/Contrato';
import * as PdfService from '../shared/container/pdf.service';

interface GenerationOptions {
  format?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  [key: string]: unknown;
}

interface UserData {
  _id?: string;
  username?: string;
  nome?: string;
  sobrenome?: string;
  email?: string;
  empresaId?: string;
  [key: string]: unknown;
}

async function generateExcelBufferFromContrato(
  _contratoId: string,
  _empresaId: string,
  _user: UserData | null
): Promise<Buffer> {
  throw new Error('Excel generation has been removed. System will be reimplemented in the future.');
}

async function generatePDFBufferFromContrato(
  contratoId: string,
  empresaId: string,
  user: UserData | null,
  options: GenerationOptions = {}
): Promise<Buffer> {
  const contrato = await Contrato.findOne({ _id: contratoId, empresaId: empresaId })
    .populate('empresaId')
    .populate({ path: 'piId', populate: { path: 'clienteId' } })
    .lean();
  if (!contrato) throw new Error('Contrato não encontrado');
  
  const pi = (contrato as any).piId;
  const cliente = pi?.clienteId;
  const empresa = (contrato as any).empresaId;
  const userFallback = user || { _id: '', username: '', nome: 'Atendimento', sobrenome: '', email: '' };

  const buffer = await PdfService.generateContrato_PDF_Buffer(pi, cliente, empresa, userFallback, options);
  return buffer;
}

export default {
  generateExcelBufferFromContrato,
  generatePDFBufferFromContrato
};
