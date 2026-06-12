import mongoose from 'mongoose';
import AppError from '@shared/container/AppError';
import { OperationTeam, IOperationTeam, IOperationTeamMember, normalizeTeamName } from './operation-team.model';

export type OperationTeamMemberInput = {
  name?: unknown;
  role?: unknown;
  phone?: unknown;
  active?: unknown;
};

export type OperationTeamSnapshot = {
  id: string;
  name: string;
  memberCount: number;
  members: Array<{ name: string; role: string | null; phone: string | null }>;
};

function duplicateTeamNameError(): AppError {
  return new AppError('Já existe uma equipe cadastrada com esse nome.', 409, undefined, 'OPERATION_TEAM_NAME_CONFLICT', 'name');
}

function isMongoDuplicateKey(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: number }).code === 11000);
}

function sanitizeMembers(members: unknown): IOperationTeamMember[] {
  if (!Array.isArray(members)) return [];
  const sanitized: IOperationTeamMember[] = [];
  for (const member of members) {
    const item = (member ?? {}) as OperationTeamMemberInput;
    const name = String(item.name ?? '').trim();
    if (!name) continue;
    const entry: IOperationTeamMember = {
      name,
      active: item.active === undefined ? true : Boolean(item.active),
    };
    if (item.role) entry.role = String(item.role).trim();
    if (item.phone) entry.phone = String(item.phone).trim();
    sanitized.push(entry);
  }
  return sanitized;
}

function countActiveMembers(members: IOperationTeamMember[]): number {
  return members.filter((member) => member.active).length;
}

export function toOperationTeamDTO(doc: IOperationTeam) {
  return {
    id: String(doc._id),
    empresaId: doc.empresaId,
    name: doc.name,
    members: (doc.members ?? []).map((member) => ({
      name: member.name,
      role: member.role ?? null,
      phone: member.phone ?? null,
      active: member.active !== false,
    })),
    memberCount: doc.memberCount,
    notes: doc.notes ?? null,
    status: doc.status,
    archivedAt: doc.archivedAt ? doc.archivedAt.toISOString() : null,
    createdAt: doc.createdAt?.toISOString?.() ?? null,
    updatedAt: doc.updatedAt?.toISOString?.() ?? null,
  };
}

export function buildOperationTeamSnapshot(doc: IOperationTeam): OperationTeamSnapshot {
  return {
    id: String(doc._id),
    name: doc.name,
    memberCount: doc.memberCount,
    members: (doc.members ?? [])
      .filter((member) => member.active !== false)
      .map((member) => ({
        name: member.name,
        role: member.role ?? null,
        phone: member.phone ?? null,
      })),
  };
}

export class OperationTeamService {
  async listTeams(empresaId: string, query: { status?: string; search?: string } = {}) {
    const filter: Record<string, unknown> = { empresaId };
    const status = String(query.status ?? '').trim().toUpperCase();
    if (status === 'ACTIVE' || status === 'ARCHIVED') {
      filter.status = status;
    }
    const search = String(query.search ?? '').trim();
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: regex }, { 'members.name': regex }];
    }
    const teams = await OperationTeam.find(filter).sort({ name: 1 }).lean<IOperationTeam[]>();
    return teams.map(toOperationTeamDTO);
  }

  async getById(empresaId: string, id: string) {
    const team = await this.findTeam(empresaId, id);
    return toOperationTeamDTO(team);
  }

  async createTeam(empresaId: string, input: Record<string, unknown>) {
    const name = String(input.name ?? '').trim();
    if (!name) {
      throw new AppError('Informe o nome da equipe.', 400, undefined, 'OPERATION_TEAM_NAME_REQUIRED', 'name');
    }
    const members = sanitizeMembers(input.members);
    const nameNormalized = normalizeTeamName(name);

    try {
      const team = await OperationTeam.create({
        empresaId,
        name,
        nameNormalized,
        members,
        memberCount: countActiveMembers(members),
        notes: input.notes ? String(input.notes).trim() : undefined,
        status: 'ACTIVE',
      });
      return toOperationTeamDTO(team.toObject() as IOperationTeam);
    } catch (error) {
      if (isMongoDuplicateKey(error)) throw duplicateTeamNameError();
      throw error;
    }
  }

  async updateTeam(empresaId: string, id: string, input: Record<string, unknown>) {
    const current = await this.findTeam(empresaId, id);

    const update: Record<string, unknown> = {};
    if (input.name !== undefined) {
      const name = String(input.name ?? '').trim();
      if (!name) {
        throw new AppError('Informe o nome da equipe.', 400, undefined, 'OPERATION_TEAM_NAME_REQUIRED', 'name');
      }
      update.name = name;
      update.nameNormalized = normalizeTeamName(name);
    }
    let members = current.members;
    if (input.members !== undefined) {
      members = sanitizeMembers(input.members);
      update.members = members;
      update.memberCount = countActiveMembers(members);
    }
    if (input.notes !== undefined) {
      update.notes = input.notes ? String(input.notes).trim() : undefined;
    }

    try {
      const updated = await OperationTeam.findOneAndUpdate(
        { _id: id, empresaId },
        { $set: update },
        { new: true },
      ).lean<IOperationTeam>();
      if (!updated) throw new AppError('Equipe operacional não encontrada.', 404, undefined, 'OPERATION_TEAM_NOT_FOUND');
      return toOperationTeamDTO(updated);
    } catch (error) {
      if (isMongoDuplicateKey(error)) throw duplicateTeamNameError();
      throw error;
    }
  }

  async archiveTeam(empresaId: string, id: string) {
    const updated = await OperationTeam.findOneAndUpdate(
      { _id: id, empresaId },
      { $set: { status: 'ARCHIVED', archivedAt: new Date() } },
      { new: true },
    ).lean<IOperationTeam>();
    if (!updated) throw new AppError('Equipe operacional não encontrada.', 404, undefined, 'OPERATION_TEAM_NOT_FOUND');
    return toOperationTeamDTO(updated);
  }

  private async findTeam(empresaId: string, id: string): Promise<IOperationTeam> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Equipe operacional inválida.', 400, undefined, 'OPERATION_TEAM_NOT_FOUND');
    }
    const team = await OperationTeam.findOne({ _id: id, empresaId }).lean<IOperationTeam>();
    if (!team) throw new AppError('Equipe operacional não encontrada.', 404, undefined, 'OPERATION_TEAM_NOT_FOUND');
    return team;
  }
}

/**
 * Resolve a equipe informada em uma operacao (create/update).
 * - teamId ausente: nenhuma alteracao (mantem vinculo atual).
 * - teamId null/vazio: remove o vinculo de equipe.
 * - teamId valido: exige equipe ACTIVE da mesma empresa, retorna teamId + snapshot atualizado.
 */
export async function resolveOperationTeamAssignment(
  empresaId: string,
  teamId: unknown,
): Promise<{ teamId: string | null; teamSnapshot: OperationTeamSnapshot | null } | null> {
  if (teamId === undefined) return null;
  if (teamId === null || teamId === '') {
    return { teamId: null, teamSnapshot: null };
  }
  const id = String(teamId);
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Equipe operacional inválida.', 400, undefined, 'OPERATION_TEAM_INVALID', 'teamId');
  }
  const team = await OperationTeam.findOne({ _id: id, empresaId, status: 'ACTIVE' }).lean<IOperationTeam>();
  if (!team) {
    throw new AppError('Equipe operacional não encontrada ou indisponível.', 404, undefined, 'OPERATION_TEAM_INVALID', 'teamId');
  }
  return { teamId: String(team._id), teamSnapshot: buildOperationTeamSnapshot(team) };
}
