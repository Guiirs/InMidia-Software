/**
 * Placa Controller
 * Camada de apresentação com Result Pattern
 */

import { Request, Response, NextFunction } from 'express';
import { IAuthRequest } from '../../../types/express.d';
import { getErrorStatusCode, Log, Cache } from '@shared/core';
import type { PlacaService } from '../services/placa.service';
import { emitEvent } from '@modules/sync/sync.registry';
import { SYNC_EVENT_TYPES } from '@modules/sync/sync.types';
import { defaultAuditService } from '@modules/audit/audit.service';
import { auditRequestContext } from '@modules/audit/audit.helpers';
import { spatialService } from '@modules/spatial';
import { eventBus } from '@modules/realtime/event-bus.service';
import { OPERATIONAL_EVENT_TYPES } from '@modules/realtime/domain-events';

// Express 5: req.params[x] é string | string[] — o cast abaixo é seguro para route params
type Params = Record<string, string>;

function getPlacaCoordinates(placa: any): string | null {
  const input = placa?.coordenadas ?? (
    placa?.latitude !== undefined && placa?.longitude !== undefined
      ? { latitude: placa.latitude, longitude: placa.longitude }
      : null
  );

  if (!input) return null;

  const normalized = spatialService.normalizeGeoPoint(input);
  if (!normalized.ok || !normalized.data) return null;

  return `${normalized.data.latitude},${normalized.data.longitude}`;
}

function emitOperationalEvent(input: {
  type: keyof typeof OPERATIONAL_EVENT_TYPES;
  companyId: string;
  entityId: string;
  severity?: 'info' | 'warning' | 'critical';
  actorId?: string;
  payload?: Record<string, unknown>;
}) {
  eventBus.emitFromInput({
    type: OPERATIONAL_EVENT_TYPES[input.type],
    companyId: input.companyId,
    entityType: 'placa',
    entityId: input.entityId,
    severity: input.severity ?? 'info',
    payload: input.payload,
    metadata: {
      actorId: input.actorId,
      source: 'placa.controller',
    },
  });
}

function withImageContract<T extends Record<string, any>>(placa: T): T {
  const imagens = Array.isArray(placa?.imagens) ? placa.imagens : [];
  const mainImage = imagens.find((image: any) => image?.isMain)
    ?? imagens.find((image: any) => image?.category === 'MAIN')
    ?? null;
  const mainImageUrl = placa?.mainImageUrl
    ?? placa?.imagemPrincipal
    ?? mainImage?.publicUrl
    ?? mainImage?.url
    ?? placa?.imagem
    ?? placa?.foto
    ?? placa?.imageUrl
    ?? null;

  return {
    ...placa,
    imagemPrincipal: mainImageUrl,
    mainImageUrl,
    imagem: placa?.imagem ?? mainImageUrl,
    imagens,
    images: imagens,
    imageStatus: mainImageUrl ? 'AVAILABLE' : 'MISSING',
  };
}

export class PlacaController {
  constructor(private readonly placaService: PlacaService) {}

  /**
   * Cria nova placa
   * POST /api/v1/placas
   */
  async createPlacaController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;

      Log.info('[PlacaController] Criando nova placa', {
        userId,
        empresaId,
        hasFile: !!req.file
      });

      const result = await this.placaService.createPlaca(
        req.body,
        req.file as any,
        empresaId,
        userId,
      );

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      // Invalidar cache
      const clearResult = await Cache.clear(`placas:*`);
      if (clearResult.isFailure) {
        Log.warn('[PlacaController] Falha ao invalidar cache', {
          error: clearResult.error.message
        });
      }

      Log.info('[PlacaController] Placa criada com sucesso', {
        placaId: result.value._id,
        numeroPlaca: result.value.numero_placa,
        userId,
        empresaId
      });

      emitEvent({
        type:      SYNC_EVENT_TYPES.PLACA_CREATED,
        entity:    'placa',
        entityId:  String(result.value._id),
        empresaId,
        actorId:   userId,
        payload:   { numero_placa: result.value.numero_placa },
      });
      emitEvent({
        type:     SYNC_EVENT_TYPES.DASHBOARD_INVALIDATED,
        entity:   'dashboard',
        entityId: 'overview',
        empresaId,
        actorId:  userId,
        payload:  { reason: 'PLACA_CREATED', placaId: String(result.value._id) },
      });
      emitOperationalEvent({
        type: 'PLACA_CREATED',
        companyId: empresaId,
        entityId: String(result.value._id),
        actorId: userId,
        payload: {
          placaId: String(result.value._id),
          numeroPlaca: result.value.numero_placa,
        },
      });

      void defaultAuditService.recordEntityCreated({
        ...auditRequestContext(req),
        module: 'placas',
        entityType: 'placa',
        entityId: String(result.value._id),
        entityLabel: result.value.numero_placa,
        after: result.value,
      });

      res.status(201).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Atualiza placa existente
   * PUT /api/v1/placas/:id
   */
  async updatePlacaController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;
      const { id: placaId } = req.params as Params;

      if (!placaId) {
        res.status(400).json({
          success: false,
          error: 'ID da placa é obrigatório'
        });
        return;
      }

      Log.info('[PlacaController] Atualizando placa', {
        placaId,
        userId,
        empresaId,
        hasFile: !!req.file
      });

      const result = await this.placaService.updatePlaca(
        placaId,
        req.body,
        req.file as any,
        empresaId,
        userId,
      );

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      // Invalidar cache
      const clearResult = await Cache.clear(`placas:*`);
      if (clearResult.isFailure) {
        Log.warn('[PlacaController] Falha ao invalidar cache', {
          error: clearResult.error.message
        });
      }

      Log.info('[PlacaController] Placa atualizada com sucesso', {
        placaId,
        userId,
        empresaId
      });

      emitEvent({
        type:     SYNC_EVENT_TYPES.PLACA_UPDATED,
        entity:   'placa',
        entityId: String(placaId),
        empresaId,
        actorId:  userId,
        payload:  { placaId },
      });
      emitEvent({
        type:     SYNC_EVENT_TYPES.DASHBOARD_INVALIDATED,
        entity:   'dashboard',
        entityId: 'overview',
        empresaId,
        actorId:  userId,
        payload:  { reason: 'PLACA_UPDATED', placaId },
      });
      emitOperationalEvent({
        type: 'PLACA_UPDATED',
        companyId: empresaId,
        entityId: String(placaId),
        actorId: userId,
        payload: {
          placaId,
          changedFields: Object.keys(req.body || {}),
        },
      });
      if (req.file) {
        emitOperationalEvent({
          type: 'PLACA_IMAGE_UPDATED',
          companyId: empresaId,
          entityId: String(placaId),
          actorId: userId,
          payload: {
            placaId,
            hasImage: true,
          },
        });
      }

      void defaultAuditService.recordEntityUpdated({
        ...auditRequestContext(req),
        module: 'placas',
        entityType: 'placa',
        entityId: String(placaId),
        entityLabel: (result.value as any).numero_placa,
        after: result.value,
        metadata: { changedFields: Object.keys(req.body || {}) },
      });

      const placa = result.value as any;
      const regiao = placa.regiaoId;
      const regiaoNome = typeof regiao === 'object' && regiao?.nome ? regiao.nome : 'Sem região';
      const regiaoId = typeof regiao === 'object' && regiao?._id ? regiao._id : regiao;
      const disponivel = placa.disponivel ?? placa.ativa ?? true;

      res.status(200).json({
        success: true,
        data: {
          ...placa,
          _id: placa._id?.toString?.() || placa._id,
          id: placa._id?.toString?.() || placa.id,
          disponivel,
          ativa: disponivel,
          nomeDaRua: placa.nomeDaRua || placa.localizacao,
          regiao: typeof regiao === 'object' ? regiao : { _id: regiaoId, id: regiaoId, nome: regiaoNome },
          regiao_nome: regiaoNome
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lista todas as placas com paginação
   * GET /api/v1/placas
   */
  async getAllPlacasController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;

      Log.info('[PlacaController] Listando placas', {
        userId,
        empresaId,
        query: req.query
      });

      // Cache key baseado nos parâmetros
      const page = req.query.page || 1;
      const limit = req.query.limit || 10;
      const cacheKey = `placas:empresa:${empresaId}:page:${page}:limit:${limit}`;

      const cachedResult = await Cache.get<any>(cacheKey);

      if (cachedResult && cachedResult.isSuccess && cachedResult.value) {
        Log.info('[PlacaController] Cache HIT para placas', {
          empresaId,
          page
        });

        res.status(200).json({
          success: true,
          ...cachedResult.value,
          cached: true
        });
        return;
      }

      Log.info('[PlacaController] Cache MISS para placas', {
        empresaId,
        page
      });

      const result = await this.placaService.listPlacas(empresaId, req.query);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      // Salvar em cache (3 minutos)
      await Cache.set(cacheKey, result.value, 180);

      Log.info('[PlacaController] Placas listadas com sucesso', {
        count: result.value.data.length,
        total: result.value.pagination.totalDocs,
        empresaId
      });

      res.status(200).json({
        success: true,
        ...result.value
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Busca placa por ID
   * GET /api/v1/placas/:id
   */
  async getPlacaByIdController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;
      const { id: placaId } = req.params as Params;

      if (!placaId) {
        res.status(400).json({
          success: false,
          error: 'ID da placa é obrigatório'
        });
        return;
      }

      Log.info('[PlacaController] Buscando placa por ID', {
        placaId,
        userId,
        empresaId
      });

      const result = await this.placaService.getPlacaById(placaId, empresaId);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      const placa = result.value as any;
      const regiao = placa.regiaoId;
      const regiaoNome = typeof regiao === 'object' && regiao?.nome ? regiao.nome : 'Sem região';
      const regiaoId = typeof regiao === 'object' && regiao?._id ? regiao._id : regiao;
      const disponivel = placa.disponivel ?? placa.ativa ?? true;

      res.status(200).json({
        success: true,
        data: {
          ...placa,
          _id: placa._id?.toString?.() || placa._id,
          id: placa._id?.toString?.() || placa.id,
          disponivel,
          ativa: disponivel,
          nomeDaRua: placa.nomeDaRua || placa.localizacao,
          regiao: typeof regiao === 'object' ? regiao : { _id: regiaoId, id: regiaoId, nome: regiaoNome },
          regiao_nome: regiaoNome
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deleta placa
   * DELETE /api/v1/placas/:id
   */
  async deletePlacaController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;
      const { id: placaId } = req.params as Params;

      if (!placaId) {
        res.status(400).json({
          success: false,
          error: 'ID da placa é obrigatório'
        });
        return;
      }

      Log.info('[PlacaController] Deletando placa', {
        placaId,
        userId,
        empresaId
      });

      const result = await this.placaService.deletePlaca(placaId, empresaId);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      // Invalidar cache
      const clearResult = await Cache.clear(`placas:*`);
      if (clearResult.isFailure) {
        Log.warn('[PlacaController] Falha ao invalidar cache', {
          error: clearResult.error.message
        });
      }

      Log.info('[PlacaController] Placa deletada com sucesso', {
        placaId,
        userId,
        empresaId
      });

      emitEvent({
        type:     SYNC_EVENT_TYPES.PLACA_DELETED,
        entity:   'placa',
        entityId: String(placaId),
        empresaId,
        actorId:  userId,
        payload:  { placaId },
      });
      emitEvent({
        type:     SYNC_EVENT_TYPES.DASHBOARD_INVALIDATED,
        entity:   'dashboard',
        entityId: 'overview',
        empresaId,
        actorId:  userId,
        payload:  { reason: 'PLACA_DELETED', placaId },
      });
      emitOperationalEvent({
        type: 'PLACA_UPDATED',
        companyId: empresaId,
        entityId: String(placaId),
        actorId: userId,
        severity: 'warning',
        payload: {
          placaId,
          action: 'deleted',
        },
      });

      void defaultAuditService.recordEntityDeleted({
        ...auditRequestContext(req),
        module: 'placas',
        entityType: 'placa',
        entityId: String(placaId),
        metadata: { placaId },
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Busca placas disponíveis por período
   * GET /api/v1/placas/disponiveis
   */
  async getPlacasDisponiveisController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;
      const { dataInicio, dataFim, data_inicio, data_fim } = req.query;

      // Normalizar parâmetros (suporta camelCase e snake_case)
      const startDate = (dataInicio || data_inicio) as string;
      const endDate = (dataFim || data_fim) as string;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'Os parâmetros dataInicio e dataFim são obrigatórios'
        });
        return;
      }

      Log.info('[PlacaController] Buscando placas disponíveis', {
        userId,
        empresaId,
        startDate,
        endDate
      });

      const placas = await (this.placaService as any).getPlacasDisponiveis(
        empresaId,
        startDate,
        endDate,
        req.query
      );

      Log.info('[PlacaController] Placas disponíveis encontradas', {
        count: placas.length,
        empresaId
      });

      res.status(200).json({
        success: true,
        data: placas,
        count: placas.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Busca localizações (coordenadas) das placas
   * GET /api/v1/placas/locations
   */
  async getPlacaLocationsController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;

      Log.info('[PlacaController] Buscando localizações das placas', {
        userId,
        empresaId
      });

      // Buscar placas com coordenadas
      const result = await this.placaService.listPlacas(
        empresaId,
        { page: '1', limit: '1000' } as any
      );

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      const locations = result.value.data
        .map((placa: any) => {
          const coordenadas = getPlacaCoordinates(placa);

          if (!coordenadas) {
            return null;
          }

          return {
            _id: placa._id,
            id: placa.id || placa._id,
            numero_placa: placa.numero_placa,
            nomeDaRua: placa.nomeDaRua || placa.localizacao,
            localizacao: placa.localizacao || placa.nomeDaRua,
            coordenadas,
            statusAluguel: placa.statusAluguel,
            regiaoId: placa.regiaoId
          };
        })
        .filter(Boolean);

      Log.info('[PlacaController] Localizações encontradas', {
        count: locations.length,
        empresaId
      });

      res.status(200).json({
        success: true,
        data: locations,
        count: locations.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Toggle disponibilidade da placa
   * PATCH /api/v1/placas/:id/disponibilidade
   */
  async toggleDisponibilidadeController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;
      const { id: placaId } = req.params as Params;

      if (!placaId) {
        res.status(400).json({
          success: false,
          error: 'ID da placa é obrigatório'
        });
        return;
      }

      Log.info('[PlacaController] Toggle disponibilidade da placa', {
        placaId,
        userId,
        empresaId
      });

      // Buscar placa atual
      const placaResult = await this.placaService.getPlacaById(placaId, empresaId);

      if (placaResult.isFailure) {
        const statusCode = getErrorStatusCode(placaResult.error);
        res.status(statusCode).json({
          success: false,
          error: placaResult.error.message,
          code: placaResult.error.code
        });
        return;
      }

      const currentPlaca = placaResult.value;

      // Usa o campo canônico `disponivel`. Aceita `ativa` como alias legado.
      const estadoAtual = currentPlaca.disponivel ?? (currentPlaca as any).ativa ?? true;

      const result = await this.placaService.updatePlaca(
        placaId,
        { disponivel: !estadoAtual } as any,
        undefined,
        empresaId
      );

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code
        });
        return;
      }

      // Invalidar cache
      await Cache.clear(`placas:*`);

      Log.info('[PlacaController] Disponibilidade alterada', {
        placaId,
        novaDisponibilidade: !estadoAtual,
        empresaId
      });

      const placa = result.value as any;
      const novaDisponibilidade = placa.disponivel ?? placa.ativa ?? true;

      emitEvent({
        type:     SYNC_EVENT_TYPES.PLACA_STATUS_CHANGED,
        entity:   'placa',
        entityId: String(placaId),
        empresaId,
        actorId:  userId,
        payload:  { disponivel: novaDisponibilidade, placaId },
      });
      emitEvent({
        type:     SYNC_EVENT_TYPES.DASHBOARD_INVALIDATED,
        entity:   'dashboard',
        entityId: 'overview',
        empresaId,
        actorId:  userId,
        payload:  { reason: 'PLACA_STATUS_CHANGED', placaId },
      });
      emitOperationalEvent({
        type: 'PLACA_STATUS_CHANGED',
        companyId: empresaId,
        entityId: String(placaId),
        actorId: userId,
        severity: novaDisponibilidade ? 'info' : 'warning',
        payload: {
          placaId,
          disponivel: novaDisponibilidade,
        },
      });

      void defaultAuditService.recordEntityUpdated({
        ...auditRequestContext(req),
        module: 'placas',
        entityType: 'placa',
        entityId: String(placaId),
        entityLabel: placa.numero_placa,
        before: { disponivel: estadoAtual },
        after: { disponivel: novaDisponibilidade },
        metadata: { action: 'toggle_disponibilidade' },
      });

      res.status(200).json({
        success: true,
        data: {
          ...placa,
          _id: placa._id?.toString?.() || placa._id,
          id: placa._id?.toString?.() || placa.id,
          disponivel: novaDisponibilidade,
          ativa: novaDisponibilidade,
          nomeDaRua: placa.nomeDaRua || placa.localizacao
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload de imagem adicional à galeria da placa
   * POST /api/v1/placas/:id/images
   */
  async uploadImageController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, error: 'Usuário não autenticado' }); return; }
      const { empresaId, id: userId } = req.user;
      const { id: placaId } = req.params as Params;

      if (!placaId) { res.status(400).json({ success: false, error: 'ID da placa é obrigatório' }); return; }
      if (!req.file) { res.status(400).json({ success: false, error: 'Arquivo de imagem é obrigatório' }); return; }

      const result = await this.placaService.uploadPlacaImage(placaId, req.file as any, req.body, empresaId, userId);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({ success: false, error: result.error.message, code: result.error.code });
        return;
      }

      await Cache.clear(`placas:*`);

      emitEvent({ type: SYNC_EVENT_TYPES.PLACA_UPDATED, entity: 'placa', entityId: placaId, empresaId, actorId: userId, payload: { action: 'IMAGE_UPLOADED', placaId } });
      emitEvent({ type: SYNC_EVENT_TYPES.DASHBOARD_INVALIDATED, entity: 'dashboard', entityId: 'overview', empresaId, actorId: userId, payload: { reason: 'PLATE_IMAGE_UPLOADED', placaId } });

      void defaultAuditService.recordEntityUpdated({ ...auditRequestContext(req), module: 'placas', entityType: 'placa', entityId: placaId, entityLabel: placaId, metadata: { action: 'IMAGE_UPLOADED' } });

      res.status(201).json({ success: true, data: withImageContract(result.value as any) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Define imagem da galeria como principal
   * PATCH /api/v1/placas/:id/images/:imageId/main
   */
  async setMainImageController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, error: 'UsuÃ¡rio nÃ£o autenticado' }); return; }
      const { empresaId, id: userId } = req.user;
      const { id: placaId, imageId } = req.params as Params & { imageId?: string };

      if (!placaId || !imageId) { res.status(400).json({ success: false, error: 'ID da placa e da imagem sÃ£o obrigatÃ³rios' }); return; }

      const result = await this.placaService.setMainImage(placaId, imageId, empresaId, userId);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({ success: false, error: result.error.message, code: result.error.code });
        return;
      }

      await Cache.clear(`placas:*`);

      emitEvent({ type: SYNC_EVENT_TYPES.PLACA_UPDATED, entity: 'placa', entityId: placaId, empresaId, actorId: userId, payload: { action: 'MAIN_IMAGE_CHANGED', placaId, imageId } });
      emitEvent({ type: SYNC_EVENT_TYPES.DASHBOARD_INVALIDATED, entity: 'dashboard', entityId: 'overview', empresaId, actorId: userId, payload: { reason: 'PLATE_MAIN_IMAGE_CHANGED', placaId } });

      void defaultAuditService.recordEntityUpdated({ ...auditRequestContext(req), module: 'placas', entityType: 'placa', entityId: placaId, entityLabel: (result.value as any).numero_placa, metadata: { action: 'PLATE_MAIN_IMAGE_CHANGED', imageId } });

      res.status(200).json({ success: true, data: withImageContract(result.value as any) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove imagem da galeria
   * DELETE /api/v1/placas/:id/images/:imageId
   */
  async removeImageController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, error: 'UsuÃ¡rio nÃ£o autenticado' }); return; }
      const { empresaId, id: userId } = req.user;
      const { id: placaId, imageId } = req.params as Params & { imageId?: string };

      if (!placaId || !imageId) { res.status(400).json({ success: false, error: 'ID da placa e da imagem sÃ£o obrigatÃ³rios' }); return; }

      const result = await this.placaService.removeImage(placaId, imageId, empresaId, userId);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({ success: false, error: result.error.message, code: result.error.code });
        return;
      }

      await Cache.clear(`placas:*`);

      emitEvent({ type: SYNC_EVENT_TYPES.PLACA_UPDATED, entity: 'placa', entityId: placaId, empresaId, actorId: userId, payload: { action: 'IMAGE_REMOVED', placaId, imageId } });
      emitEvent({ type: SYNC_EVENT_TYPES.DASHBOARD_INVALIDATED, entity: 'dashboard', entityId: 'overview', empresaId, actorId: userId, payload: { reason: 'PLATE_IMAGE_REMOVED', placaId } });

      void defaultAuditService.recordEntityUpdated({ ...auditRequestContext(req), module: 'placas', entityType: 'placa', entityId: placaId, entityLabel: (result.value as any).numero_placa, metadata: { action: 'PLATE_IMAGE_REMOVED', imageId } });

      res.status(200).json({ success: true, data: withImageContract(result.value as any) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Arquiva placa (soft delete)
   * POST /api/v1/placas/:id/archive
   */
  async archivePlacaController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, error: 'Usuário não autenticado' }); return; }
      const { empresaId, id: userId } = req.user;
      const { id: placaId } = req.params as Params;
      if (!placaId) { res.status(400).json({ success: false, error: 'ID da placa é obrigatório' }); return; }

      const result = await this.placaService.archivePlaca(placaId, req.body, empresaId, userId);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({ success: false, error: result.error.message, code: result.error.code });
        return;
      }

      await Cache.clear(`placas:*`);

      emitEvent({ type: SYNC_EVENT_TYPES.PLACA_UPDATED, entity: 'placa', entityId: placaId, empresaId, actorId: userId, payload: { action: 'ARCHIVED', placaId } });
      emitEvent({ type: SYNC_EVENT_TYPES.DASHBOARD_INVALIDATED, entity: 'dashboard', entityId: 'overview', empresaId, actorId: userId, payload: { reason: 'PLATE_ARCHIVED', placaId } });

      void defaultAuditService.recordEntityUpdated({ ...auditRequestContext(req), module: 'placas', entityType: 'placa', entityId: placaId, entityLabel: (result.value as any).numero_placa, metadata: { action: 'ARCHIVED' } });

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Restaura placa arquivada
   * POST /api/v1/placas/:id/restore
   */
  async restorePlacaController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, error: 'Usuário não autenticado' }); return; }
      const { empresaId, id: userId } = req.user;
      const { id: placaId } = req.params as Params;
      if (!placaId) { res.status(400).json({ success: false, error: 'ID da placa é obrigatório' }); return; }

      const result = await this.placaService.restorePlaca(placaId, empresaId, userId);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({ success: false, error: result.error.message, code: result.error.code });
        return;
      }

      await Cache.clear(`placas:*`);

      emitEvent({ type: SYNC_EVENT_TYPES.PLACA_UPDATED, entity: 'placa', entityId: placaId, empresaId, actorId: userId, payload: { action: 'RESTORED', placaId } });
      emitEvent({ type: SYNC_EVENT_TYPES.DASHBOARD_INVALIDATED, entity: 'dashboard', entityId: 'overview', empresaId, actorId: userId, payload: { reason: 'PLATE_RESTORED', placaId } });

      void defaultAuditService.recordEntityUpdated({ ...auditRequestContext(req), module: 'placas', entityType: 'placa', entityId: placaId, entityLabel: (result.value as any).numero_placa, metadata: { action: 'RESTORED' } });

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Timeline da placa
   * GET /api/v1/placas/:id/timeline
   */
  async getTimelineController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, error: 'Usuário não autenticado' }); return; }
      const { empresaId } = req.user;
      const { id: placaId } = req.params as Params;
      if (!placaId) { res.status(400).json({ success: false, error: 'ID da placa é obrigatório' }); return; }

      const result = await this.placaService.getPlacaTimeline(placaId, empresaId);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({ success: false, error: result.error.message, code: result.error.code });
        return;
      }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Disponibilidade da placa para um período
   * GET /api/v1/placas/:id/availability?startDate=...&endDate=...
   */
  async getAvailabilityController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, error: 'Usuário não autenticado' }); return; }
      const { empresaId } = req.user;
      const { id: placaId } = req.params as Params;
      const { startDate, endDate } = req.query as Record<string, string>;

      if (!placaId) { res.status(400).json({ success: false, error: 'ID da placa é obrigatório' }); return; }
      if (!startDate || !endDate) { res.status(400).json({ success: false, error: 'startDate e endDate são obrigatórios' }); return; }

      const result = await this.placaService.getPlacaAvailability(placaId, startDate, endDate, empresaId);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({ success: false, error: result.error.message, code: result.error.code });
        return;
      }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Health score da placa
   * GET /api/v1/placas/:id/health
   */
  async getHealthController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ success: false, error: 'Usuário não autenticado' }); return; }
      const { empresaId } = req.user;
      const { id: placaId } = req.params as Params;
      if (!placaId) { res.status(400).json({ success: false, error: 'ID da placa é obrigatório' }); return; }

      const result = await this.placaService.getPlacaHealth(placaId, empresaId);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({ success: false, error: result.error.message, code: result.error.code });
        return;
      }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reorganiza a numeração visual das placas sem alterar IDs internos
   * PATCH /api/v1/placas/reorder
   */
  async reorderPlacasController(
    req: Request & IAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Usuário não autenticado'
        });
        return;
      }

      const { empresaId, id: userId } = req.user;

      const beforeResult = await this.placaService.listPlacas(empresaId, {
        page: 1,
        limit: 1000,
        sortBy: 'numeroOperacional',
        order: 'asc',
      });

      const result = await this.placaService.reorderPlacas(empresaId, req.body);

      if (result.isFailure) {
        const statusCode = getErrorStatusCode(result.error);
        res.status(statusCode).json({
          success: false,
          error: result.error.message,
          code: result.error.code,
        });
        return;
      }

      const clearResult = await Cache.clear('placas:*');
      if (clearResult.isFailure) {
        Log.warn('[PlacaController] Falha ao invalidar cache após reorder', {
          error: clearResult.error.message,
          empresaId,
        });
      }

      const orderedListResult = await this.placaService.listPlacas(empresaId, {
        page: 1,
        limit: 1000,
        sortBy: 'numeroOperacional',
        order: 'asc',
      });

      if (orderedListResult.isFailure) {
        const statusCode = getErrorStatusCode(orderedListResult.error);
        res.status(statusCode).json({
          success: false,
          error: orderedListResult.error.message,
          code: orderedListResult.error.code,
        });
        return;
      }

      const updatedList = orderedListResult.value.data;

      emitEvent({
        type:     SYNC_EVENT_TYPES.PLACA_UPDATED,
        entity:   'placa',
        entityId: 'reorder',
        empresaId,
        actorId:  userId,
        payload:  { action: 'REORDER', total: updatedList.length },
      });
      emitEvent({
        type:     SYNC_EVENT_TYPES.DASHBOARD_INVALIDATED,
        entity:   'dashboard',
        entityId: 'overview',
        empresaId,
        actorId:  userId,
        payload:  { reason: 'PLACA_REORDER' },
      });
      emitOperationalEvent({
        type: 'PLACA_UPDATED',
        companyId: empresaId,
        entityId: 'reorder',
        actorId: userId,
        payload: {
          action: 'reorder',
          total: updatedList.length,
        },
      });

      void defaultAuditService.recordAuditEvent({
        ...auditRequestContext(req),
        module: 'placas',
        action: 'placas.reordered',
        severity: 'info',
        entityType: 'placa',
        entityId: 'bulk',
        entityLabel: 'Organização Das Placas',
        before: beforeResult.isSuccess ? beforeResult.value.data.map((p) => ({ id: p.id, numeroOperacional: p.numeroOperacional })) : [],
        after: updatedList.map((p) => ({ id: p.id, numeroOperacional: p.numeroOperacional })),
        metadata: {
          total: updatedList.length,
          message: 'Reorganização da numeração visual das placas',
        },
      });

      res.status(200).json({
        success: true,
        message: 'Numeração visual organizada com sucesso',
        data: updatedList,
      });
    } catch (error) {
      next(error);
    }
  }
}
