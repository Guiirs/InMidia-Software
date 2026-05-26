/**
 * Client V4.1 Repository
 */

import { FilterQuery, Types } from 'mongoose';
import Cliente from './Cliente';
import { Result, DomainError, DatabaseError, DuplicateKeyError, toDomainError, Log } from '@shared/core';
import type {
  CreateClientDTO,
  UpdateClientDTO,
  ListClientsQueryDTO,
  SearchClientsQueryDTO,
  ClientEntity,
  ClientSummary,
  PaginatedClientsResponse,
  ClientTimelineEvent,
} from './client.dto';
import { toClientSummary, toClientEntity } from './client.dto';

export interface IClientRepository {
  create(data: CreateClientDTO, empresaId: string, userId?: string): Promise<Result<ClientEntity, DomainError>>;
  findById(id: string, empresaId: string): Promise<Result<ClientEntity | null, DomainError>>;
  findAll(empresaId: string, query: ListClientsQueryDTO): Promise<Result<PaginatedClientsResponse, DomainError>>;
  update(id: string, data: UpdateClientDTO, empresaId: string, userId?: string): Promise<Result<ClientEntity, DomainError>>;
  archive(id: string, empresaId: string, userId?: string): Promise<Result<ClientEntity, DomainError>>;
  restore(id: string, empresaId: string, userId?: string): Promise<Result<ClientEntity, DomainError>>;
  search(empresaId: string, query: SearchClientsQueryDTO): Promise<Result<ClientSummary[], DomainError>>;
  getTimeline(id: string, empresaId: string): Promise<Result<ClientTimelineEvent[], DomainError>>;
  resolveClient(id: string, empresaId: string): Promise<Result<{ id: string; nome: string; documento?: string } | null, DomainError>>;
  documentoExistsForEmpresa(documento: string, empresaId: string, excludeId?: string): Promise<boolean>;
}

export class ClientRepository implements IClientRepository {

  async create(
    data: CreateClientDTO,
    empresaId: string,
    userId?: string
  ): Promise<Result<ClientEntity, DomainError>> {
    try {
      const duplicate = await this.documentoExistsForEmpresa(data.documento, empresaId);
      if (duplicate) {
        return Result.fail(new DuplicateKeyError('documento'));
      }

      const doc = new Cliente({
        ...data,
        documento:  data.documento,
        cpfCnpj:    data.documento,
        status:     data.status ?? 'ACTIVE',
        ativo:      true,
        empresaId,
        createdBy:  userId ? new Types.ObjectId(userId) : undefined,
        updatedBy:  userId ? new Types.ObjectId(userId) : undefined,
      });

      await doc.save();
      Log.info('[ClientRepository] Cliente V4.1 criado', { clientId: doc._id, empresaId });
      return Result.ok(toClientEntity(doc.toObject()));
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const field = getMongodupeField(error);
        return Result.fail(new DuplicateKeyError(field));
      }
      return Result.fail(new DatabaseError('create', toDomainError(error).message));
    }
  }

  async findById(
    id: string,
    empresaId: string
  ): Promise<Result<ClientEntity | null, DomainError>> {
    try {
      const doc = await Cliente.findOne({ _id: id, empresaId }).lean();
      if (!doc) return Result.ok(null);
      return Result.ok(toClientEntity(doc));
    } catch (error) {
      return Result.fail(new DatabaseError('findById', toDomainError(error).message));
    }
  }

  async findAll(
    empresaId: string,
    query: ListClientsQueryDTO
  ): Promise<Result<PaginatedClientsResponse, DomainError>> {
    try {
      const { page, limit, sortBy, order, status, tipoPessoa, cidade, estado, includeArchived } = query;

      const filter: FilterQuery<any> = { empresaId };

      if (status) {
        filter.status = status;
      } else if (!includeArchived) {
        filter.status = { $ne: 'ARCHIVED' };
      }

      if (tipoPessoa) filter.tipoPessoa = tipoPessoa;
      if (cidade) filter.cidade = { $regex: cidade, $options: 'i' };
      if (estado) filter.estado = estado.toUpperCase();

      const skip = (page - 1) * limit;
      const sortOrder = order === 'desc' ? -1 : 1;

      const [docs, total] = await Promise.all([
        Cliente.find(filter)
          .sort({ [sortBy]: sortOrder })
          .skip(skip)
          .limit(limit)
          .lean(),
        Cliente.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);

      return Result.ok({
        data: docs.map(toClientSummary),
        pagination: {
          totalDocs:   total,
          totalPages,
          currentPage: page,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      return Result.fail(new DatabaseError('findAll', toDomainError(error).message));
    }
  }

  async update(
    id: string,
    data: UpdateClientDTO,
    empresaId: string,
    userId?: string
  ): Promise<Result<ClientEntity, DomainError>> {
    try {
      if (data.documento) {
        const duplicate = await this.documentoExistsForEmpresa(data.documento, empresaId, id);
        if (duplicate) {
          return Result.fail(new DuplicateKeyError('documento'));
        }
      }

      const updatePayload: Record<string, unknown> = {
        ...data,
        updatedBy: userId ? new Types.ObjectId(userId) : undefined,
      };

      if (data.documento) {
        updatePayload.cpfCnpj = data.documento;
      }

      const doc = await Cliente.findOneAndUpdate(
        { _id: id, empresaId, status: { $ne: 'ARCHIVED' } },
        { $set: updatePayload },
        { new: true, runValidators: true }
      ).lean();

      if (!doc) {
        const { ClienteNotFoundError } = await import('@shared/core');
        return Result.fail(new ClienteNotFoundError(id));
      }

      Log.info('[ClientRepository] Cliente V4.1 atualizado', { clientId: id, empresaId });
      return Result.ok(toClientEntity(doc));
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return Result.fail(new DuplicateKeyError(getMongodupeField(error)));
      }
      return Result.fail(new DatabaseError('update', toDomainError(error).message));
    }
  }

  async archive(
    id: string,
    empresaId: string,
    userId?: string
  ): Promise<Result<ClientEntity, DomainError>> {
    try {
      const doc = await Cliente.findOneAndUpdate(
        { _id: id, empresaId, status: { $ne: 'ARCHIVED' } },
        {
          $set: {
            status:     'ARCHIVED',
            ativo:      false,
            archivedAt: new Date(),
            archivedBy: userId ? new Types.ObjectId(userId) : undefined,
            updatedBy:  userId ? new Types.ObjectId(userId) : undefined,
          },
        },
        { new: true }
      ).lean();

      if (!doc) {
        const { ClienteNotFoundError } = await import('@shared/core');
        return Result.fail(new ClienteNotFoundError(id));
      }

      Log.info('[ClientRepository] Cliente arquivado', { clientId: id, empresaId });
      return Result.ok(toClientEntity(doc));
    } catch (error) {
      return Result.fail(new DatabaseError('archive', toDomainError(error).message));
    }
  }

  async restore(
    id: string,
    empresaId: string,
    userId?: string
  ): Promise<Result<ClientEntity, DomainError>> {
    try {
      const doc = await Cliente.findOneAndUpdate(
        { _id: id, empresaId, status: 'ARCHIVED' },
        {
          $set: {
            status:    'ACTIVE',
            ativo:     true,
            updatedBy: userId ? new Types.ObjectId(userId) : undefined,
          },
          $unset: { archivedAt: 1, archivedBy: 1 },
        },
        { new: true }
      ).lean();

      if (!doc) {
        const { ClienteNotFoundError } = await import('@shared/core');
        return Result.fail(new ClienteNotFoundError(id));
      }

      Log.info('[ClientRepository] Cliente restaurado', { clientId: id, empresaId });
      return Result.ok(toClientEntity(doc));
    } catch (error) {
      return Result.fail(new DatabaseError('restore', toDomainError(error).message));
    }
  }

  async search(
    empresaId: string,
    query: SearchClientsQueryDTO
  ): Promise<Result<ClientSummary[], DomainError>> {
    try {
      const { q, limit } = query;
      const term = q.trim();

      const numericTerm = term.replace(/\D/g, '');
      const orConditions: FilterQuery<any>[] = [
        { nome:        { $regex: term, $options: 'i' } },
        { nomeFantasia:{ $regex: term, $options: 'i' } },
        { responsavel: { $regex: term, $options: 'i' } },
        { email:       { $regex: term, $options: 'i' } },
      ];

      if (numericTerm.length > 0) {
        orConditions.push(
          { telefone:  { $regex: numericTerm, $options: 'i' } },
          { documento: { $regex: numericTerm, $options: 'i' } },
          { cpfCnpj:   { $regex: numericTerm, $options: 'i' } }
        );
      }

      const filter: FilterQuery<any> = {
        empresaId,
        status: { $ne: 'ARCHIVED' },
        $or: orConditions,
      };

      const docs = await Cliente.find(filter)
        .select('nome nomeFantasia documento cpfCnpj tipoPessoa responsavel email telefone status cidade')
        .limit(limit)
        .lean();

      return Result.ok(docs.map(toClientSummary));
    } catch (error) {
      return Result.fail(new DatabaseError('search', toDomainError(error).message));
    }
  }

  async getTimeline(
    id: string,
    empresaId: string
  ): Promise<Result<ClientTimelineEvent[], DomainError>> {
    try {
      const doc = await Cliente.findOne({ _id: id, empresaId }).lean();
      if (!doc) {
        const { ClienteNotFoundError } = await import('@shared/core');
        return Result.fail(new ClienteNotFoundError(id));
      }

      const events: ClientTimelineEvent[] = [];

      events.push({
        id:        `created-${doc._id}`,
        type:      'created',
        label:     'Cliente criado',
        userId:    doc.createdBy?.toString(),
        timestamp: doc.createdAt as Date,
      });

      if (doc.archivedAt) {
        events.push({
          id:        `archived-${doc._id}`,
          type:      'archived',
          label:     'Cliente arquivado',
          userId:    doc.archivedBy?.toString(),
          timestamp: doc.archivedAt as Date,
        });
      }

      if (doc.updatedAt > doc.createdAt && !doc.archivedAt) {
        events.push({
          id:        `updated-${doc._id}`,
          type:      'updated',
          label:     'Dados atualizados',
          userId:    doc.updatedBy?.toString(),
          timestamp: doc.updatedAt as Date,
        });
      }

      // Enrich with PI and contrato counts (lightweight — just counts)
      try {
        const [PropostaInterna, Contrato] = await Promise.all([
          import('@modules/propostas-internas/PropostaInterna').then((m) => m.default),
          import('@modules/contratos/Contrato').then((m) => m.default),
        ]);

        const [pisCount, contratosCount] = await Promise.all([
          PropostaInterna.countDocuments({ clienteId: id, empresaId }),
          Contrato.countDocuments({ clienteId: id, empresaId }),
        ]);

        if (pisCount > 0) {
          events.push({
            id:        `pis-${doc._id}`,
            type:      'pi',
            label:     `${pisCount} Proposta(s) Interna(s) vinculada(s)`,
            timestamp: doc.updatedAt as Date,
          });
        }

        if (contratosCount > 0) {
          events.push({
            id:        `contratos-${doc._id}`,
            type:      'contract',
            label:     `${contratosCount} Contrato(s) vinculado(s)`,
            timestamp: doc.updatedAt as Date,
          });
        }
      } catch {
        // enrichment is best-effort
      }

      return Result.ok(events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()));
    } catch (error) {
      return Result.fail(new DatabaseError('getTimeline', toDomainError(error).message));
    }
  }

  async resolveClient(
    id: string,
    empresaId: string
  ): Promise<Result<{ id: string; nome: string; documento?: string } | null, DomainError>> {
    try {
      const doc = await Cliente.findOne({ _id: id, empresaId })
        .select('nome documento cpfCnpj')
        .lean();

      if (!doc) return Result.ok(null);

      return Result.ok({
        id:        doc._id.toString(),
        nome:      doc.nome,
        documento: doc.documento ?? doc.cpfCnpj,
      });
    } catch (error) {
      return Result.fail(new DatabaseError('resolveClient', toDomainError(error).message));
    }
  }

  async documentoExistsForEmpresa(
    documento: string,
    empresaId: string,
    excludeId?: string
  ): Promise<boolean> {
    const filter: FilterQuery<any> = {
      empresaId,
      $or: [{ documento }, { cpfCnpj: documento }],
    };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    const count = await Cliente.countDocuments(filter);
    return count > 0;
  }
}

// ── helpers ────────────────────────────────────────────────────────────────────

function isDuplicateKeyError(err: unknown): boolean {
  return !!(err && typeof err === 'object' && 'code' in err && (err as any).code === 11000);
}

function getMongodupeField(err: unknown): string {
  if (err && typeof err === 'object' && 'keyPattern' in err) {
    const keys = Object.keys((err as any).keyPattern ?? {});
    return keys[0] ?? 'documento';
  }
  return 'documento';
}
