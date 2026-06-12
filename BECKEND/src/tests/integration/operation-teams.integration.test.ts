import request from 'supertest';
import { Types } from 'mongoose';
import { OperationTeam } from '../../modules/operations/operation-teams/operation-team.model';
import {
  app,
  clearDatabase,
  ensureTestEmpresa,
  generateTestToken,
  setupIntegrationDb,
  teardownIntegrationDb,
} from './setup';

const TEAMS_BASE = '/api/v4/operation-teams';
const OPERATIONS_BASE = '/api/v4/operations';

describe('Operation Teams V4 integration', () => {
  let adminToken: string;
  let vendedorToken: string;

  beforeAll(async () => {
    await setupIntegrationDb();
    await OperationTeam.syncIndexes();
    adminToken = generateTestToken({ role: 'admin_empresa' });
    vendedorToken = generateTestToken({ role: 'vendedor' });
  });

  afterAll(async () => {
    await teardownIntegrationDb();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  async function createTeam(token: string, overrides: Record<string, unknown> = {}) {
    const res = await request(app)
      .post(TEAMS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Equipe Instalação Norte',
        members: [
          { name: 'João Silva', role: 'Instalador', phone: '11999990000', active: true },
          { name: 'Maria Souza', role: 'Auxiliar', active: true },
        ],
        ...overrides,
      });
    return res;
  }

  async function createOperation(token: string, overrides: Record<string, unknown> = {}) {
    const res = await request(app)
      .post(OPERATIONS_BASE)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Tarefa operacional genérica',
        domain: 'system',
        type: 'INSTALLATION',
        ...overrides,
      });
    return res;
  }

  it('cria uma equipe com integrantes e calcula memberCount a partir dos ativos', async () => {
    const res = await createTeam(adminToken, {
      name: 'Equipe Alpha',
      members: [
        { name: 'João Silva', role: 'Instalador', active: true },
        { name: 'Maria Souza', role: 'Auxiliar', active: false },
        { name: 'Pedro Lima', active: true },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.data.team.name).toBe('Equipe Alpha');
    expect(res.body.data.team.members).toHaveLength(3);
    expect(res.body.data.team.memberCount).toBe(2);
    expect(res.body.data.team.status).toBe('ACTIVE');
  });

  it('rejeita nome duplicado de equipe na mesma empresa', async () => {
    const first = await createTeam(adminToken, { name: '  Equipe   Beta  ' });
    expect(first.status).toBe(201);

    const second = await createTeam(adminToken, { name: 'equipe beta' });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('OPERATION_TEAM_NAME_CONFLICT');
  });

  it('rejeita nome duplicado mesmo quando a diferenca e apenas acento', async () => {
    expect((await createTeam(adminToken, { name: 'Equipe Instalação' })).status).toBe(201);

    const duplicate = await createTeam(adminToken, { name: 'equipe instalacao' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('OPERATION_TEAM_NAME_CONFLICT');
  });

  it('permite o mesmo nome de equipe em empresas diferentes', async () => {
    const otherEmpresaId = new Types.ObjectId().toString();
    await ensureTestEmpresa(otherEmpresaId);
    const otherToken = generateTestToken({ role: 'admin_empresa', empresaId: otherEmpresaId });

    const first = await createTeam(adminToken, { name: 'Equipe Compartilhada' });
    expect(first.status).toBe(201);

    const second = await createTeam(otherToken, { name: 'Equipe Compartilhada' });
    expect(second.status).toBe(201);
  });

  it('arquivar equipe remove ela das ativas mas mantém acesso direto', async () => {
    const created = await createTeam(adminToken, { name: 'Equipe Gama' });
    const teamId = created.body.data.team.id;

    const archived = await request(app)
      .post(`${TEAMS_BASE}/${teamId}/archive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(archived.status).toBe(200);
    expect(archived.body.data.team.status).toBe('ARCHIVED');

    const activeList = await request(app)
      .get(`${TEAMS_BASE}?status=ACTIVE`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(activeList.body.data.teams.find((t: any) => t.id === teamId)).toBeUndefined();

    const archivedList = await request(app)
      .get(`${TEAMS_BASE}?status=ARCHIVED`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(archivedList.body.data.teams.find((t: any) => t.id === teamId)).toBeDefined();

    const byId = await request(app)
      .get(`${TEAMS_BASE}/${teamId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(byId.status).toBe(200);
    expect(byId.body.data.team.id).toBe(teamId);
  });

  it('cria operação com teamId válido e grava teamId + teamSnapshot', async () => {
    const created = await createTeam(adminToken, { name: 'Equipe Delta' });
    const team = created.body.data.team;

    const op = await createOperation(adminToken, { teamId: team.id });
    expect(op.status).toBe(201);
    const task = op.body.data.task;
    expect(task.teamId).toBe(team.id);
    expect(task.teamSnapshot).toEqual({
      id: team.id,
      name: 'Equipe Delta',
      memberCount: 2,
      members: [
        { name: 'João Silva', role: 'Instalador', phone: '11999990000' },
        { name: 'Maria Souza', role: 'Auxiliar', phone: null },
      ],
    });
  });

  it('rejeita operação com equipe de outra empresa', async () => {
    const otherEmpresaId = new Types.ObjectId().toString();
    await ensureTestEmpresa(otherEmpresaId);
    const otherToken = generateTestToken({ role: 'admin_empresa', empresaId: otherEmpresaId });

    const otherTeam = await createTeam(otherToken, { name: 'Equipe de Outra Empresa' });
    expect(otherTeam.status).toBe(201);

    const op = await createOperation(adminToken, { teamId: otherTeam.body.data.team.id });
    expect(op.status).toBe(404);
    expect(op.body.code).toBe('OPERATION_TEAM_INVALID');
  });

  it('rejeita operação com equipe arquivada', async () => {
    const created = await createTeam(adminToken, { name: 'Equipe Epsilon' });
    const teamId = created.body.data.team.id;

    await request(app)
      .post(`${TEAMS_BASE}/${teamId}/archive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const op = await createOperation(adminToken, { teamId });
    expect(op.status).toBe(404);
    expect(op.body.code).toBe('OPERATION_TEAM_INVALID');
  });

  it('atualiza teamId e teamSnapshot ao trocar a equipe de uma operação aberta', async () => {
    const teamA = (await createTeam(adminToken, { name: 'Equipe Zeta' })).body.data.team;
    const teamB = (await createTeam(adminToken, {
      name: 'Equipe Omega',
      members: [{ name: 'Carlos Pereira', role: 'Líder', active: true }],
    })).body.data.team;

    const op = await createOperation(adminToken, { teamId: teamA.id });
    const operationId = op.body.data.task.id;

    const updated = await request(app)
      .patch(`${OPERATIONS_BASE}/tasks/${operationId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ teamId: teamB.id });

    expect(updated.status).toBe(200);
    expect(updated.body.data.task.teamId).toBe(teamB.id);
    expect(updated.body.data.task.teamSnapshot.name).toBe('Equipe Omega');
    expect(updated.body.data.task.teamSnapshot.members).toEqual([
      { name: 'Carlos Pereira', role: 'Líder', phone: null },
    ]);
  });

  it('operação concluída mantém o snapshot histórico mesmo após a equipe ser arquivada', async () => {
    const team = (await createTeam(adminToken, { name: 'Equipe Theta' })).body.data.team;

    const op = await createOperation(adminToken, { teamId: team.id });
    const operationId = op.body.data.task.id;

    const completed = await request(app)
      .post(`${OPERATIONS_BASE}/${operationId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(completed.status).toBe(200);

    await request(app)
      .post(`${TEAMS_BASE}/${team.id}/archive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const fetched = await request(app)
      .get(`${OPERATIONS_BASE}/${operationId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(fetched.status).toBe(200);
    expect(fetched.body.data.teamId).toBe(team.id);
    expect(fetched.body.data.teamSnapshot.name).toBe('Equipe Theta');
  });

  it('garante isolamento multi-tenant: equipe de outra empresa não é acessível', async () => {
    const otherEmpresaId = new Types.ObjectId().toString();
    await ensureTestEmpresa(otherEmpresaId);
    const otherToken = generateTestToken({ role: 'admin_empresa', empresaId: otherEmpresaId });

    const otherTeam = await createTeam(otherToken, { name: 'Equipe Isolada' });

    const res = await request(app)
      .get(`${TEAMS_BASE}/${otherTeam.body.data.team.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('aplica RBAC: papel sem operations.create não pode criar equipe', async () => {
    const res = await createTeam(vendedorToken, { name: 'Equipe Sem Permissão' });
    expect(res.status).toBe(403);
  });
});
