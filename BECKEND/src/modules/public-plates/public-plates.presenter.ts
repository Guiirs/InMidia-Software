/** Mapeia um documento de Placa (com regiaoId populado) para o payload público seguro. */

export interface PublicPlacaPayload {
  id: string;
  slug: string;
  codigo: string;
  nome: string;
  localizacao: string | null;
  status: 'disponivel' | 'reservado' | 'ocupado' | 'indisponivel' | 'desconhecido';
  imagemUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  endereco: string | null;
  regiao: string | null;
  cidade: string | null;
  categoria: string | null;
  medidas: string | null;
  imagem: string | null;
  disponibilidade: 'disponivel' | 'reservado' | 'ocupado' | 'indisponivel' | 'desconhecido';
  updatedAt: string | null;
}

export interface PublicRegiaoPayload {
  slug: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
}

export interface PublicDisponibilidadePayload {
  total: number;
  disponivel: number;
  reservado: number;
  ocupado: number;
  indisponivel: number;
}

const statusComercialMap: Record<string, PublicPlacaPayload['disponibilidade']> = {
  AVAILABLE: 'disponivel',
  RESERVED: 'reservado',
  OCCUPIED: 'ocupado',
  UNAVAILABLE: 'indisponivel',
};

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toPublicPlaca(raw: any): PublicPlacaPayload {
  const regiaoDoc = typeof raw.regiaoId === 'object' && raw.regiaoId !== null
    ? raw.regiaoId
    : null;

  const endereco = raw.endereco || raw.nomeDaRua || raw.localizacao || null;
  const imagem = raw.imagemPrincipal || raw.imagem || null;
  const statusComercial: string = raw.statusComercial ?? 'AVAILABLE';
  const disponibilidade = statusComercialMap[statusComercial] ?? 'desconhecido';
  const id = raw._id?.toString?.() ?? String(raw._id ?? '');
  const codigo = raw.numero_placa ?? '';

  return {
    id,
    slug: toSlug(codigo),
    codigo,
    nome: codigo,
    localizacao: endereco,
    status: disponibilidade,
    imagemUrl: imagem,
    latitude: typeof raw.latitude === 'number' ? raw.latitude : null,
    longitude: typeof raw.longitude === 'number' ? raw.longitude : null,
    endereco,
    regiao: regiaoDoc?.nome ?? raw.regiaoNome ?? null,
    cidade: regiaoDoc?.city ?? null,
    categoria: raw.tipo ?? null,
    medidas: raw.tamanho ?? null,
    imagem,
    disponibilidade,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : null,
  };
}

export function toPublicRegiao(raw: any): PublicRegiaoPayload {
  const nome: string = raw.nome || raw.name || '';
  return {
    slug: toSlug(raw.code || raw.codigo || nome),
    nome,
    cidade: raw.city ?? null,
    estado: raw.state ?? null,
  };
}
