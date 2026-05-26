import Placa from '@modules/placas/Placa';
import Aluguel from '@modules/alugueis/Aluguel';
import { regionService } from '@modules/regions/region.service';
import mongoose from 'mongoose';
import AppError from '@shared/container/AppError';

export interface CreateBoardPayload {
  numero_placa?: string;
  codigo?: string;
  endereco?: string;
  localizacao?: string;
  nomeDaRua?: string;
  latitude?: number | string;
  longitude?: number | string;
  coordinates?: unknown;
  coordenadas?: unknown;
  tamanho?: string;
  tipo?: string;
  imagem?: string;
  imagemPrincipal?: string;
  imageUrl?: string;
  regiaoId?: string;
  regionId?: string;
  regionalLot?: string;
  loteRegional?: string;
  statusOperacional?: string;
  notes?: string;
  observacoes?: string;
  disponivel?: boolean;
}

type BoardStatus = 'occupied' | 'available' | 'reserved' | 'maintenance' | 'critical';

function toDate(input: unknown): Date | null {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(String(input));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toNumber(input: unknown): number {
  const v = Number(input ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function toFiniteNumber(input: unknown): number | null {
  if (input === null || input === undefined || input === '') return null;
  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

function normalizeCoordinatePair(latitude: unknown, longitude: unknown): { latitude: number; longitude: number } | null {
  const lat = toFiniteNumber(latitude);
  const lng = toFiniteNumber(longitude);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

export function normalizeInventoryBoardCoordinates(input: Record<string, unknown>): { latitude: number; longitude: number } | null {
  const direct = normalizeCoordinatePair(input.latitude, input.longitude);
  if (direct) return direct;

  const short = normalizeCoordinatePair(input.lat, input.lng ?? input.lon);
  if (short) return short;

  const candidates = [input.coordinates, input.coordenadas];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.includes(',')) {
      const [lat, lng] = candidate.split(',').map((part) => part.trim());
      const normalized = normalizeCoordinatePair(lat, lng);
      if (normalized) return normalized;
    }

    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const objectCandidate = candidate as Record<string, unknown>;
      const objectCoords = normalizeCoordinatePair(
        objectCandidate.latitude ?? objectCandidate.lat,
        objectCandidate.longitude ?? objectCandidate.lng ?? objectCandidate.lon,
      );
      if (objectCoords) return objectCoords;
    }
  }

  for (const key of ['localizacao', 'location', 'geo']) {
    const holder = input[key] as any;
    if (Array.isArray(holder?.coordinates) && holder.coordinates.length >= 2) {
      const geoJson = normalizeCoordinatePair(holder.coordinates[1], holder.coordinates[0]);
      if (geoJson) return geoJson;
    }
  }

  return null;
}

function toId(input: unknown): string {
  if (!input) return '';
  return String((input as any)?._id ?? (input as any)?.id ?? input);
}

function isActive(aluguel: any, now: Date): boolean {
  if (aluguel?.status === 'cancelado' || aluguel?.status === 'finalizado') return false;
  const start = toDate(aluguel?.startDate ?? aluguel?.data_inicio);
  const end = toDate(aluguel?.endDate ?? aluguel?.data_fim);
  return Boolean(start && end && start <= now && end >= now);
}

function isFuture(aluguel: any, now: Date): boolean {
  if (aluguel?.status === 'cancelado' || aluguel?.status === 'finalizado') return false;
  const start = toDate(aluguel?.startDate ?? aluguel?.data_inicio);
  return Boolean(start && start > now);
}

function getBoardStatus(placa: any, rentals: any[], now: Date): BoardStatus {
  if (rentals.some((r) => isActive(r, now))) return 'occupied';
  if (rentals.some((r) => isFuture(r, now))) return 'reserved';
  if ((placa?.disponivel ?? placa?.ativa ?? true) === false) return 'maintenance';
  return 'available';
}

export interface BoardListItem {
  id: string;
  codigo: string;
  endereco: string | null;
  localizacao: string | null;
  nomeDaRua: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinates: { latitude: number; longitude: number } | null;
  coordenadas: string | null;
  localizacaoGeo?: unknown;
  tamanho: string | null;
  tipo?: string | null;
  imagem: string | null;
  imagemPrincipal: string | null;
  mainImageUrl: string | null;
  imagens: unknown[];
  images: unknown[];
  imageStatus: 'AVAILABLE' | 'MISSING' | 'BROKEN' | 'PROCESSING';
  regiaoId: string | null;
  regionId: string | null;
  regionalLot: string | null;
  loteRegional: string | null;
  statusOperacional: string | null;
  notes: string | null;
  observacoes: string | null;
  archivedAt: string | null;
  disponivel: boolean;
  status: BoardStatus;
  regiao: { id: string; nome: string; codigo?: string } | null;
  valorMensal: number;
  aluguelAtivo: {
    id: string;
    clienteId: string | null;
    startDate: string | null;
    endDate: string | null;
  } | null;
}

export interface BoardsListResult {
  boards: BoardListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InventoryRegionItem {
  id: string;
  name: string;
  code?: string;
  color?: string | null;
  city?: string | null;
  state?: string | null;
  centerLatitude?: number | null;
  centerLongitude?: number | null;
  boundary?: unknown;
  polygon?: unknown;
  totalBoards: number;
  availableBoards: number;
  occupiedBoards: number;
  reservedBoards: number;
  maintenanceBoards: number;
  criticalBoards: number;
  occupancyRate: number;
  pendingOperations?: number;
  criticalAlertsCount?: number;
  endingContracts?: number;
  operationalBacklog?: number;
  boards: BoardListItem[];
}

export interface InventoryRegionsResult {
  regions: InventoryRegionItem[];
  total: number;
}

export class InventoryBoardsService {
  private toEmpresaObjectId(empresaId: string): mongoose.Types.ObjectId {
    return new mongoose.Types.ObjectId(empresaId);
  }

  private async findBoardOrFail(empresaId: string, boardId: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      throw new AppError('ID de placa invalido.', 400);
    }

    const placa = await Placa.findOne({
      _id: new mongoose.Types.ObjectId(boardId),
      empresaId: this.toEmpresaObjectId(empresaId),
    }).lean();

    if (!placa) {
      throw new AppError('Placa nao encontrada.', 404);
    }

    return placa;
  }

  private normalizeImageContract(placa: any): {
    imagemPrincipal: string | null;
    imagens: unknown[];
    imageStatus: 'AVAILABLE' | 'MISSING';
  } {
    const imagens = Array.isArray(placa.imagens) ? placa.imagens : [];
    const mainImage = imagens.find((image: any) => image?.isMain)
      ?? imagens.find((image: any) => image?.category === 'MAIN')
      ?? null;
    const imagemPrincipal = placa.mainImageUrl
      ?? placa.imagemPrincipal
      ?? mainImage?.publicUrl
      ?? mainImage?.url
      ?? placa.imagem
      ?? placa.foto
      ?? placa.imageUrl
      ?? null;

    return {
      imagemPrincipal,
      imagens,
      imageStatus: imagemPrincipal ? 'AVAILABLE' : 'MISSING',
    };
  }

  async listBoards(
    empresaId: string,
    options: { page?: number; limit?: number; status?: string; search?: string; regiaoId?: string } = {},
  ): Promise<BoardsListResult> {
    const now = new Date();
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(200, Math.max(1, options.limit ?? 50));

    const query: Record<string, unknown> = { empresaId: this.toEmpresaObjectId(empresaId) };
    if (options.regiaoId && mongoose.Types.ObjectId.isValid(options.regiaoId)) {
      query.regiaoId = new mongoose.Types.ObjectId(options.regiaoId);
    }
    if (options.search?.trim()) {
      const re = new RegExp(options.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { numero_placa: re },
        { nomeDaRua: re },
        { coordenadas: re },
      ];
    }

    const placas = await Placa.find(query)
      .populate('regiaoId', 'nome codigo name code color city state centerLatitude centerLongitude polygon')
      .lean();

    const placaIds = placas.map((p: any) => p._id);

    const alugueis =
      placaIds.length > 0
        ? await Aluguel.find({
            empresaId,
            status: { $ne: 'cancelado' },
            $or: [{ placaId: { $in: placaIds } }, { placa: { $in: placaIds } }],
          }).lean()
        : [];

    const rentalsByBoard = new Map<string, any[]>();
    alugueis.forEach((a: any) => {
      const pid = toId(a.placaId ?? a.placa);
      if (!pid) return;
      if (!rentalsByBoard.has(pid)) rentalsByBoard.set(pid, []);
      rentalsByBoard.get(pid)!.push(a);
    });

    const boards: BoardListItem[] = placas.map((placa: any) => {
      const rentals = rentalsByBoard.get(String(placa._id)) ?? [];
      const status = getBoardStatus(placa, rentals, now);
      const activeRental = rentals.find((r) => isActive(r, now)) ?? null;
      const regiaoRaw = placa.regiaoId;
      const coordinates = normalizeInventoryBoardCoordinates(placa);
      const endereco = placa.endereco ?? placa.nomeDaRua ?? (typeof placa.localizacao === 'string' ? placa.localizacao : null) ?? null;
      const regiaoId = toId(regiaoRaw) || toId(placa.regiaoId) || null;
      const imageContract = this.normalizeImageContract(placa);
      const imagemPrincipal = imageContract.imagemPrincipal;

      return {
        id: String(placa._id),
        codigo: placa.numero_placa ?? '',
        endereco,
        localizacao: typeof placa.localizacao === 'string' ? placa.localizacao : endereco,
        nomeDaRua: placa.nomeDaRua ?? endereco,
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        coordinates,
        coordenadas: coordinates ? `${coordinates.latitude},${coordinates.longitude}` : (typeof placa.coordenadas === 'string' ? placa.coordenadas : null),
        localizacaoGeo: placa.localizacao && typeof placa.localizacao === 'object' ? placa.localizacao : undefined,
        tamanho: placa.tamanho ?? null,
        tipo: placa.tipo ?? null,
        imagem: placa.imagem ?? imagemPrincipal,
        imagemPrincipal,
        mainImageUrl: imagemPrincipal,
        imagens: imageContract.imagens,
        images: imageContract.imagens,
        imageStatus: imageContract.imageStatus,
        regiaoId,
        regionId: placa.regionId ? toId(placa.regionId) : regiaoId,
        regionalLot: placa.regionalLot ?? placa.loteRegional ?? null,
        loteRegional: placa.loteRegional ?? placa.regionalLot ?? null,
        statusOperacional: placa.statusOperacional ?? null,
        notes: placa.notes ?? placa.observacoes ?? null,
        observacoes: placa.observacoes ?? placa.notes ?? null,
        archivedAt: placa.archivedAt ? (toDate(placa.archivedAt)?.toISOString() ?? null) : null,
        disponivel: placa.disponivel ?? true,
        status,
        regiao: regiaoRaw && typeof regiaoRaw === 'object'
          ? {
              id: toId(regiaoRaw),
              nome: (regiaoRaw as any).nome ?? (regiaoRaw as any).name ?? '',
              codigo: (regiaoRaw as any).codigo ?? (regiaoRaw as any).code,
              color: (regiaoRaw as any).color ?? null,
              city: (regiaoRaw as any).city ?? null,
              state: (regiaoRaw as any).state ?? null,
              centerLatitude: (regiaoRaw as any).centerLatitude ?? null,
              centerLongitude: (regiaoRaw as any).centerLongitude ?? null,
              polygon: (regiaoRaw as any).polygon ?? null,
            } as any
          : null,
        valorMensal: toNumber(placa.valor_mensal),
        aluguelAtivo: activeRental
          ? {
              id: String(activeRental._id),
              clienteId: activeRental.clienteId ? String(activeRental.clienteId) : null,
              startDate: toDate(activeRental.startDate ?? activeRental.data_inicio)?.toISOString() ?? null,
              endDate: toDate(activeRental.endDate ?? activeRental.data_fim)?.toISOString() ?? null,
            }
          : null,
      };
    });

    const filtered = options.status
      ? boards.filter((b) => b.status === options.status)
      : boards;

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);

    return { boards: paged, total, page, limit, totalPages };
  }

  async getBoardById(empresaId: string, boardId: string): Promise<BoardListItem> {
    const placa = await this.findBoardOrFail(empresaId, boardId);
    const filtered = await this.listBoards(empresaId, {
      page: 1,
      limit: 200,
      search: placa.numero_placa ?? String(placa._id),
    });
    const found = filtered.boards.find((item) => item.id === boardId);
    if (!found) throw new AppError('Placa nao encontrada.', 404);
    return found;
  }

  async updateBoard(
    empresaId: string,
    boardId: string,
    payload: Record<string, unknown>,
  ): Promise<BoardListItem> {
    await this.findBoardOrFail(empresaId, boardId);

    const allowed: Record<string, unknown> = {};
    if (typeof payload.numero_placa === 'string' && payload.numero_placa.trim()) allowed.numero_placa = payload.numero_placa.trim();
    if (typeof payload.codigo === 'string' && payload.codigo.trim()) allowed.numero_placa = payload.codigo.trim();
    const address = typeof payload.endereco === 'string'
      ? payload.endereco.trim()
      : typeof payload.nomeDaRua === 'string'
        ? payload.nomeDaRua.trim()
        : typeof payload.localizacao === 'string'
          ? payload.localizacao.trim()
          : '';
    if (address) {
      allowed.endereco = address;
      allowed.nomeDaRua = address;
      allowed.localizacao = address;
    }
    const coordinates = normalizeInventoryBoardCoordinates(payload);
    if (coordinates) {
      allowed.latitude = coordinates.latitude;
      allowed.longitude = coordinates.longitude;
      allowed.coordenadas = `${coordinates.latitude},${coordinates.longitude}`;
    } else if (typeof payload.coordenadas === 'string') {
      allowed.coordenadas = payload.coordenadas.trim();
    }
    if (typeof payload.tamanho === 'string') allowed.tamanho = payload.tamanho.trim();
    if (typeof payload.tipo === 'string') allowed.tipo = payload.tipo.trim();
    if (typeof payload.imagem === 'string') allowed.imagem = payload.imagem.trim();
    if (typeof payload.imageUrl === 'string') allowed.imagem = payload.imageUrl.trim();
    if (typeof payload.imagemPrincipal === 'string') {
      allowed.imagemPrincipal = payload.imagemPrincipal.trim();
      allowed.imagem = payload.imagemPrincipal.trim();
    }
    if (typeof payload.disponivel === 'boolean') allowed.disponivel = payload.disponivel;
    if (typeof payload.statusOperacional === 'string') allowed.statusOperacional = payload.statusOperacional.trim();
    if (typeof payload.regionalLot === 'string') allowed.regionalLot = payload.regionalLot.trim();
    if (typeof payload.loteRegional === 'string') allowed.loteRegional = payload.loteRegional.trim();
    if (typeof payload.notes === 'string') allowed.notes = payload.notes.trim();
    if (typeof payload.observacoes === 'string') allowed.observacoes = payload.observacoes.trim();
    const regionId = typeof payload.regiaoId === 'string' ? payload.regiaoId : typeof payload.regionId === 'string' ? payload.regionId : null;
    if (regionId && mongoose.Types.ObjectId.isValid(regionId)) {
      allowed.regiaoId = new mongoose.Types.ObjectId(regionId);
    }

    const updated = await Placa.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(boardId), empresaId: this.toEmpresaObjectId(empresaId) },
      { $set: allowed },
      { new: true, runValidators: true },
    ).lean();

    if (!updated) throw new AppError('Placa nao encontrada.', 404);
    return this.getBoardById(empresaId, boardId);
  }

  async toggleAvailability(empresaId: string, boardId: string): Promise<BoardListItem> {
    const current = await this.findBoardOrFail(empresaId, boardId);
    const next = !Boolean(current.disponivel ?? true);

    await Placa.updateOne(
      { _id: new mongoose.Types.ObjectId(boardId), empresaId: this.toEmpresaObjectId(empresaId) },
      { $set: { disponivel: next } },
    );

    return this.getBoardById(empresaId, boardId);
  }

  async createBoard(empresaId: string, payload: CreateBoardPayload): Promise<BoardListItem> {
    const codigo = (payload.numero_placa ?? payload.codigo ?? '').trim();
    if (!codigo) throw new AppError('Codigo da placa e obrigatorio.', 400);

    const regionId = payload.regiaoId ?? payload.regionId;
    if (!regionId || !mongoose.Types.ObjectId.isValid(regionId)) {
      throw new AppError('regiaoId valido e obrigatorio.', 400);
    }
    const address = payload.endereco?.trim() || payload.nomeDaRua?.trim() || payload.localizacao?.trim() || undefined;
    const coordinates = normalizeInventoryBoardCoordinates(payload as Record<string, unknown>);
    const image = payload.imagemPrincipal?.trim() || payload.imagem?.trim() || payload.imageUrl?.trim() || undefined;

    const doc = await Placa.create({
      numero_placa: codigo,
      endereco: address,
      nomeDaRua: address,
      localizacao: address,
      latitude: coordinates?.latitude,
      longitude: coordinates?.longitude,
      coordenadas: coordinates ? `${coordinates.latitude},${coordinates.longitude}` : (typeof payload.coordenadas === 'string' ? payload.coordenadas.trim() : undefined),
      tamanho: payload.tamanho?.trim() || undefined,
      tipo: payload.tipo?.trim() || undefined,
      imagem: image,
      imagemPrincipal: image,
      regiaoId: new mongoose.Types.ObjectId(regionId),
      empresaId: this.toEmpresaObjectId(empresaId),
      regionalLot: payload.regionalLot?.trim() || undefined,
      loteRegional: payload.loteRegional?.trim() || payload.regionalLot?.trim() || undefined,
      statusOperacional: payload.statusOperacional?.trim() || undefined,
      notes: payload.notes?.trim() || undefined,
      observacoes: payload.observacoes?.trim() || payload.notes?.trim() || undefined,
      disponivel: payload.disponivel ?? true,
    });

    return this.getBoardById(empresaId, String(doc._id));
  }

  async deleteBoard(empresaId: string, boardId: string): Promise<BoardListItem> {
    const board = await this.getBoardById(empresaId, boardId);

    const activeRentals = await Aluguel.countDocuments({
      empresaId,
      $or: [
        { placaId: new mongoose.Types.ObjectId(boardId) },
        { placa: new mongoose.Types.ObjectId(boardId) },
      ],
      status: { $nin: ['cancelado', 'finalizado'] },
    });

    if (activeRentals > 0) {
      throw new AppError(
        'Placa possui contrato ativo. Encerre ou cancele o contrato antes de excluir.',
        409,
      );
    }

    await Placa.deleteOne({
      _id: new mongoose.Types.ObjectId(boardId),
      empresaId: this.toEmpresaObjectId(empresaId),
    });

    return board;
  }

  async listRegions(empresaId: string): Promise<InventoryRegionsResult> {
    const result = await this.listBoards(empresaId, { page: 1, limit: 200 });
    const regionMap = new Map<string, InventoryRegionItem>();

    result.boards.forEach((board) => {
      const regionId = board.regiao?.id || 'sem-regiao';
      if (!regionMap.has(regionId)) {
        regionMap.set(regionId, {
          id: regionId,
          name: board.regiao?.nome || 'Sem regiao',
          code: board.regiao?.codigo,
          color: (board.regiao as any)?.color ?? null,
          city: (board.regiao as any)?.city ?? null,
          state: (board.regiao as any)?.state ?? null,
          centerLatitude: (board.regiao as any)?.centerLatitude ?? null,
          centerLongitude: (board.regiao as any)?.centerLongitude ?? null,
          boundary: (board.regiao as any)?.polygon ?? null,
          polygon: (board.regiao as any)?.polygon ?? null,
          totalBoards: 0,
          availableBoards: 0,
          occupiedBoards: 0,
          reservedBoards: 0,
          maintenanceBoards: 0,
          criticalBoards: 0,
          occupancyRate: 0,
          boards: [],
        });
      }

      const region = regionMap.get(regionId)!;
      region.totalBoards += 1;
      region.boards.push(board);
      if (board.status === 'available') region.availableBoards += 1;
      if (board.status === 'occupied') region.occupiedBoards += 1;
      if (board.status === 'reserved') region.reservedBoards += 1;
      if (board.status === 'maintenance') region.maintenanceBoards += 1;
      if (board.status === 'critical') region.criticalBoards += 1;
    });

    const regions = await Promise.all(Array.from(regionMap.values()).map(async (region) => {
      const occupancyRate = region.totalBoards > 0
        ? Math.round((region.occupiedBoards / region.totalBoards) * 10000) / 10000
        : 0;

      if (!mongoose.Types.ObjectId.isValid(region.id) || region.id === 'sem-regiao') {
        return { ...region, occupancyRate };
      }

      try {
        const summary = await regionService.getRegionSummary(region.id, empresaId);
        return {
          ...region,
          occupancyRate,
          pendingOperations: summary.pendingOperations,
          criticalAlertsCount: summary.criticalAlertsCount,
          endingContracts: summary.endingContracts,
          operationalBacklog: summary.operationalBacklog,
        };
      } catch {
        return { ...region, occupancyRate };
      }
    }));

    return {
      regions: regions.sort((a, b) => b.totalBoards - a.totalBoards || a.name.localeCompare(b.name)),
      total: regions.length,
    };
  }
}
