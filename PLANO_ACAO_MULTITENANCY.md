# 🔧 PLANO DE AÇÃO DETALHADO - CORREÇÃO DE ISOLAMENTO MULTI-TENANT

## FASE 1: EMERGENCIAL (0-48 horas)

### ⚠️ Tarefa 1.1: Verificar Status de pi-sync.service.ts
**Arquivo**: `/g:/Inmidia V4/BECKEND/src/legacy/pi-sync.service.ts`

**Status Atual**: Arquivo marcado com `@ts-nocheck` e comentário "não usado pelas rotas ativas"

**Ações**:
- [ ] Confirmar se está realmente inativo em rotas
- [ ] Se **INATIVO**: Adicionar comentário de SEGURANÇA e data de deprecação
- [ ] Se **ATIVO**: Chamar reunião de emergência - arquivo requer reescrita total

**Código de Mitigação (se ativo)**:
```typescript
// @ts-nocheck — DEPRECATED: Arquivo legado com vulnerabilidades multi-tenant críticas
// Data de deprecação: 29/05/2026
// TODO: Reescrever com isolamento de tenant antes de usar em produção
// Ver: RELATORIO_AUDITORIA_MULTITENANCY.md

class PISyncService {
  static async syncPIsWithAlugueis(empresaId: string) {  // ← ADICIONADO PARÂMETRO
    logger.info(`[PISyncService] 🔄 Iniciando validação PI ↔ Aluguéis para empresa ${empresaId}...`);
    
    try {
      const pisAtivas = await PropostaInterna.find({
        empresaId,  // ← ADICIONADO FILTRO
        status: { $in: ['em_andamento', 'concluida'] }
      }).lean();
      // ... resto do código
    }
  }
}
```

---

### 🔴 Tarefa 1.2: PAUSAR temporal-scheduler.service.ts - CRÍTICO
**Arquivo**: `/g:/Inmidia V4/BECKEND/src/modules/temporal/temporal-scheduler.service.ts`

**Status**: ATIVO - ROD A CADA HORA - CRÍTICO IMEDIATO

**Linha Problemática 193**:
```typescript
// ❌ CRÍTICO - PARAR IMEDIATAMENTE
TemporalReservation.find({}).lean<ITemporalReservation[]>(),
```

**Ação Imediata**:
```typescript
// MITIGAÇÃO TEMPORÁRIA (até correção permanente)
async getTemporalIntegrityReport(now: Date = new Date()) {
  // 🚨 TEMPORÁRIO: Desabilitar método até correção de multi-tenant
  logger.error('[TemporalScheduler] 🚨 CRÍTICO: getTemporalIntegrityReport desabilitado por vulnerabilidade multi-tenant');
  throw new Error('Método desabilitado por segurança');
  
  // Código anterior removido até correção
}
```

**Teste de Validação**:
```bash
# Após correção, validar que apenas dados do tenant são processados
TEST_EMPRESA_ID=empresa-1 npm test -- temporal-scheduler.isolation.test
```

---

### ⚠️ Tarefa 1.3: Auditar WhatsApp em Produção
**Arquivo**: `/g:/Inmidia V4/BECKEND/src/modules/whatsapp/`

**Verificar**:
- [ ] Se WhatsApp está habilitado em produção
- [ ] Se `gerarRelatorio()` é chamado com multi-tenant

**Se Ativo**: Implementar parada segura
```typescript
async gerarRelatorio(empresaId: string | null = null) {
  // 🚨 ADICIONADO VALIDAÇÃO
  if (!empresaId) {
    throw new Error('empresaId é obrigatório para gerarRelatorio()');
  }
  
  const query = { empresaId };  // ← Sempre filtra por empresa
  const placas = await Placa.find(query)
    .populate('regiaoId', 'nome')
    .sort({ numero_placa: 1 })
    .lean();
  // ... resto do código
}
```

---

## FASE 2: CORREÇÃO (Semana 1)

### ✅ Tarefa 2.1: Corrigir pi-sync.service.ts (7 pontos)

**Se arquivo for ativado em produção, aplicar:**

```typescript
// ANTES:
class PISyncService {
  static async syncPIsWithAlugueis() {
    const pisAtivas = await PropostaInterna.find({
      status: { $in: ['em_andamento', 'concluida'] }
    }).lean();
```

```typescript
// DEPOIS:
class PISyncService {
  static async syncPIsWithAlugueis(empresaId: string) {
    logger.info(`[PISyncService] Sincronizando para empresa: ${empresaId}`);
    
    const pisAtivas = await PropostaInterna.find({
      empresaId,  // ← ADICIONADO
      status: { $in: ['em_andamento', 'concluida'] }
    }).lean();
```

**Pontos a Corrigir**:
1. Linha 21: `find({status})` → `find({empresaId, status})`
2. Linha 77: `find({pi_code})` → `find({empresaId, pi_code})`
3. Linha 125: `deleteMany({_id})` → `deleteMany({_id, empresaId})`
4. Linha 146: `updateMany({pi_code})` → `updateMany({pi_code, empresaId})`
5. Linha 172: `updateMany({pi_code})` → `updateMany({pi_code, empresaId})`
6. Linha 201: `find({tipo})` → `find({empresaId, tipo})`
7. Linha 223: `deleteMany({_id})` → `deleteMany({_id, empresaId})`

---

### ✅ Tarefa 2.2: Corrigir temporal-scheduler.service.ts (3 pontos)

**Arquivo**: `/g:/Inmidia V4/BECKEND/src/modules/temporal/temporal-scheduler.service.ts`

**Linha 192-194 - ANTES**:
```typescript
async getTemporalIntegrityReport(now: Date = new Date()) {
  const [contracts, reservations, plates] = await Promise.all([
    Contrato.find({ status: { $ne: 'cancelado' } }).populate('piId').lean<any[]>(),
    TemporalReservation.find({}).lean<ITemporalReservation[]>(),
    Placa.find({ disponivel: false }).lean<any[]>(),
  ]);
```

**DEPOIS**:
```typescript
async getTemporalIntegrityReport(empresaId?: string, now: Date = new Date()) {
  // Se não houver empresaId, pode ser scheduler global
  // Nesse caso, processar POR EMPRESA em loop
  
  if (!empresaId) {
    logger.warn('[TemporalScheduler] Rodando integrity report para TODAS as empresas...');
    const empresas = await Empresa.find({}).select('_id').lean();
    for (const emp of empresas) {
      await this.getTemporalIntegrityReport(String(emp._id), now);
    }
    return;
  }

  const [contracts, reservations, plates] = await Promise.all([
    Contrato.find({ 
      empresaId,  // ← ADICIONADO
      status: { $ne: 'cancelado' } 
    }).populate('piId').lean<any[]>(),
    TemporalReservation.find({ empresaId }).lean<ITemporalReservation[]>(),  // ← ADICIONADO
    Placa.find({ 
      empresaId,  // ← ADICIONADO
      disponivel: false 
    }).lean<any[]>(),
  ]);
```

---

### ✅ Tarefa 2.3: Corrigir temporal.service.ts (3 pontos)

**Arquivo**: `/g:/Inmidia V4/BECKEND/src/modules/temporal/temporal.service.ts`

**Linhas 654-656 - ANTES**:
```typescript
const [contracts, pis, rentals] = await Promise.all([
  contractIds.length > 0 ? Contrato.find({ _id: { $in: contractIds } }).populate('piId', 'valorTotal').lean<any[]>() : [],
  piIds.length > 0 ? PropostaInterna.find({ _id: { $in: piIds } }).select('valorTotal').lean<any[]>() : [],
  rentalIds.length > 0 ? Aluguel.find({ _id: { $in: rentalIds } }).lean<any[]>() : [],
]);
```

**DEPOIS**:
```typescript
const [contracts, pis, rentals] = await Promise.all([
  contractIds.length > 0 ? Contrato.find({ 
    _id: { $in: contractIds },
    empresaId  // ← ADICIONADO - valida empresa do contrato
  }).populate('piId', 'valorTotal').lean<any[]>() : [],
  piIds.length > 0 ? PropostaInterna.find({ 
    _id: { $in: piIds },
    empresaId  // ← ADICIONADO
  }).select('valorTotal').lean<any[]>() : [],
  rentalIds.length > 0 ? Aluguel.find({ 
    _id: { $in: rentalIds },
    empresaId  // ← ADICIONADO
  }).lean<any[]>() : [],
]);
```

**Nota**: empresaId está disponível em contexto da função resolveReservationValues

---

### ✅ Tarefa 2.4: Corrigir whatsapp.service.ts (2 pontos)

**Linhas 349, 358**:

**ANTES**:
```typescript
async gerarRelatorio(empresaId: string | null = null) {
  // ...
  const query = empresaId ? { empresaId } : {};  // ← INSEGURO: pode ser vazio
  const placas = await Placa.find(query).populate('regiaoId', 'nome').lean();
  
  const empresaFilter: Record<string, unknown> = empresaId ? { empresaId } : {};
  const alugueisAtivos = await Aluguel.find({
    ...empresaFilter,  // ← Pode estar vazio se empresaId for null
    startDate: { $lte: hoje },
    endDate: { $gte: hoje }
  }).lean();
}
```

**DEPOIS**:
```typescript
async gerarRelatorio(empresaId: string) {  // ← OBRIGATÓRIO, não opcional
  if (!empresaId) {
    throw new Error('empresaId é obrigatório para gerarRelatorio()');
  }
  
  const placas = await Placa.find({ empresaId })  // ← Sempre com filtro
    .populate('regiaoId', 'nome')
    .sort({ numero_placa: 1 })
    .lean();

  const alugueisAtivos = await Aluguel.find({
    empresaId,  // ← Sempre presente
    startDate: { $lte: hoje },
    endDate: { $gte: hoje }
  })
  .populate('placaId', '_id numero_placa')
  .populate('clienteId', 'nome')
  .lean();
}
```

---

### ✅ Tarefa 2.5: Corrigir whatsapp.repository.ts (2 pontos)

**Arquivo**: `/g:/Inmidia V4/BECKEND/src/modules/whatsapp/repositories/whatsapp.repository.ts`

**Linhas 179, 261**:

**ANTES (Linha 179)**:
```typescript
async createTemplate(data: CreateTemplateInput) {
  const existing = await WhatsAppTemplate.findOne({ name: data.name });  // ← Sem empresaId
  if (existing) {
    return Result.fail(...);
  }
}
```

**DEPOIS**:
```typescript
async createTemplate(data: CreateTemplateInput, empresaId: string) {  // ← ADICIONADO parâmetro
  const existing = await WhatsAppTemplate.findOne({ 
    name: data.name,
    empresaId  // ← ADICIONADO filtro
  });
  if (existing) {
    return Result.fail(...);
  }
}
```

**ANTES (Linha 261)**:
```typescript
async listTemplates(query: ListTemplatesQuery) {
  const filter: any = {};
  if (active !== undefined) {
    filter.active = active;  // ← Filter incompleto, sem empresaId
  }
  const templates = await WhatsAppTemplate.find(filter).lean();
}
```

**DEPOIS**:
```typescript
async listTemplates(query: ListTemplatesQuery, empresaId: string) {
  const filter: any = {
    empresaId  // ← OBRIGATÓRIO
  };
  if (active !== undefined) {
    filter.active = active;
  }
  const templates = await WhatsAppTemplate.find(filter).lean();
}
```

---

## FASE 3: TESTES DE VALIDAÇÃO (Semana 1)

### 📋 Teste 1: Isolamento de Leitura
```typescript
describe('[SECURITY] Multi-Tenant Data Isolation - READ', () => {
  let empresaA: any, empresaB: any;

  beforeAll(async () => {
    empresaA = await Empresa.create({ nome: 'Empresa A' });
    empresaB = await Empresa.create({ nome: 'Empresa B' });
  });

  it('Empresa A NÃO pode ler dados de Empresa B - Placas', async () => {
    const placaB = await Placa.create({ empresaId: empresaB._id, numero_placa: 'ABC-1234' });
    
    // Tentar ler como Empresa A
    const found = await Placa.findOne({ _id: placaB._id, empresaId: empresaA._id });
    expect(found).toBeNull();  // Deve retornar null
  });

  it('Empresa A NÃO pode ler dados de Empresa B - TemporalReservation', async () => {
    const reservB = await TemporalReservation.create({ 
      empresaId: empresaB._id,
      plateId: 'placa-1',
      sourceType: 'CONTRACT',
      status: 'ACTIVE'
    });
    
    // Tentar ler scheduler como Empresa A
    const found = await TemporalReservation.findOne({ 
      _id: reservB._id,
      empresaId: empresaA._id 
    });
    expect(found).toBeNull();
  });
});
```

### 📋 Teste 2: Isolamento de Escrita
```typescript
describe('[SECURITY] Multi-Tenant Data Isolation - WRITE', () => {
  let empresaA: any, empresaB: any;

  it('Empresa A NÃO pode modificar dados de Empresa B', async () => {
    const aluguelB = await Aluguel.create({
      empresaId: empresaB._id,
      valor_mensal: 1000,
      status: 'ativo'
    });

    // Tentar atualizar como Empresa A
    const updated = await Aluguel.updateOne(
      { _id: aluguelB._id, empresaId: empresaA._id },  // Com filtro de tenant
      { $set: { valor_mensal: 2000 } }
    );

    expect(updated.modifiedCount).toBe(0);  // Não deve modificar

    // Verificar que não foi alterado
    const reread = await Aluguel.findById(aluguelB._id);
    expect(reread.valor_mensal).toBe(1000);  // Mantém original
  });
});
```

### 📋 Teste 3: Isolamento de Deleção
```typescript
describe('[SECURITY] Multi-Tenant Data Isolation - DELETE', () => {
  it('Empresa A NÃO pode deletar dados de Empresa B', async () => {
    const aluguelB = await Aluguel.create({
      empresaId: empresaB._id,
      numero_placa: 'ZZZ-9999'
    });

    // Tentar deletar como Empresa A
    const deleted = await Aluguel.deleteOne({
      _id: aluguelB._id,
      empresaId: empresaA._id  // Com filtro de tenant
    });

    expect(deleted.deletedCount).toBe(0);  // Não deve deletar

    // Verificar que continua existindo
    const reread = await Aluguel.findById(aluguelB._id);
    expect(reread).toBeTruthy();  // Mantém documento
  });
});
```

### 📋 Teste 4: Scheduler Isolado
```typescript
describe('[SECURITY] Scheduler Multi-Tenant Isolation', () => {
  it('Scheduler temporal processa apenas seu tenant', async () => {
    // Criar reservas em duas empresas
    const reservA = await TemporalReservation.create({
      empresaId: empresaA._id,
      plateId: 'p1',
      sourceType: 'CONTRACT'
    });
    const reservB = await TemporalReservation.create({
      empresaId: empresaB._id,
      plateId: 'p2',
      sourceType: 'CONTRACT'
    });

    // Executar scheduler para Empresa A
    const scheduler = new TemporalSchedulerService();
    const result = await scheduler.expirePastReservations(
      { empresaId: String(empresaA._id) },
      new Date()
    );

    // Verificar que apenas A foi processado
    const reservAAfter = await TemporalReservation.findById(reservA._id);
    expect(reservAAfter.processedAt).toBeDefined();  // Processado

    const reservBAfter = await TemporalReservation.findById(reservB._id);
    expect(reservBAfter.processedAt).toBeUndefined();  // Não processado
  });
});
```

---

## FASE 4: PREVENÇÃO (Sprint Seguinte)

### 📌 Implementar Linter Customizado

**Arquivo**: `.eslintrc.json` - adicionar regra customizada

```json
{
  "rules": {
    "no-unfiltered-find": {
      "type": "problem",
      "docs": {
        "description": "Detecta Model.find() sem empresaId",
        "category": "Security"
      },
      "messages": {
        "unfiltered": "⚠️ SEGURANÇA: Query sem empresaId - pode vazar dados multi-tenant"
      }
    }
  }
}
```

### 📌 Adicionar à CI/CD

```yaml
# .github/workflows/security-multitenancy.yml
name: Multi-Tenant Security Check

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Check for unfiltered database queries
        run: |
          # Falha se encontrar .find({}), .find({...}) sem empresaId
          if grep -r "\.find({}" BECKEND/src/modules; then
            echo "❌ FALHA: Queries sem empresaId detectadas"
            exit 1
          fi
          echo "✅ Segurança multi-tenant validada"
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### FASE 1
- [ ] Tarefa 1.1: Verificar pi-sync status
- [ ] Tarefa 1.2: Pausar/Mitigar temporal-scheduler
- [ ] Tarefa 1.3: Auditar WhatsApp produção

### FASE 2
- [ ] Tarefa 2.1: Corrigir pi-sync (7 pontos)
- [ ] Tarefa 2.2: Corrigir temporal-scheduler (3 pontos)
- [ ] Tarefa 2.3: Corrigir temporal.service (3 pontos)
- [ ] Tarefa 2.4: Corrigir whatsapp.service (2 pontos)
- [ ] Tarefa 2.5: Corrigir whatsapp.repository (2 pontos)

### FASE 3
- [ ] Teste 1: Isolamento de leitura
- [ ] Teste 2: Isolamento de escrita
- [ ] Teste 3: Isolamento de deleção
- [ ] Teste 4: Scheduler isolado
- [ ] Validar 100% dos testes passando
- [ ] Rodar testes 10x (verificar race conditions)

### FASE 4
- [ ] Linter customizado
- [ ] CI/CD com segurança
- [ ] Documentação atualizada
- [ ] Code review policy
- [ ] Treinamento da equipe

---

## 📊 TIMELINE RECOMENDADA

| Fase | Duração | Status | Responsável |
|------|---------|--------|-------------|
| FASE 1 (Emergencial) | 48h | ⚠️ CRÍTICA | Backend Lead |
| FASE 2 (Correção) | 5 dias | 🔴 BLOQUEADOR | Dev Team (3 pessoas) |
| FASE 3 (Testes) | 3 dias | 🟡 IMPORTANTE | QA + Devs |
| FASE 4 (Prevenção) | 5 dias | 🟢 PREVENTIVO | DevOps + Backend Lead |
| **TOTAL** | **~2 semanas** | | |

---

## 🎯 CRITÉRIOS DE ACEITAÇÃO

✅ **Pronto para Produção Multi-Tenant quando:**

1. Todos os 17 pontos corrigidos e validados
2. 100% dos 4 testes de isolamento passando
3. Zero queries sem empresaId em commits
4. Relatório de segurança assinado
5. Deploy em staging com 2+ tenants - sem vazamento
6. Documentação atualizada
7. Equipe treinada

---

**Documento Criado**: 29 de Maio de 2026  
**Status**: 🔴 **URGENTE - IMPLEMENTAR IMEDIATAMENTE**
