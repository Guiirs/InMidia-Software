# 🎬 EXEMPLOS PRÁTICOS - Migração Passo a Passo

**Arquivo:** Guia visual com exemplos reais de uso do script de migração

---

## 📋 Cenário 1: Migração Completa do Zero

### **Situação:**
Banco de dados novo/staging com ~5000 documentos a migrar.

### **Passos:**

#### 1️⃣ Verificar Conexão
```bash
cd BECKEND

# Testar se MongoDB está acessível
mongo $MONGO_URI --eval "db.stats()"
```

#### 2️⃣ Backup (OBRIGATÓRIO)
```bash
# Criar backup com timestamp
mongodump --uri="$MONGO_URI" --out="backup-$(date +%Y%m%d-%H%M%S)"

# Verificar tamanho do backup
du -sh backup-*
```

#### 3️⃣ Dry-Run (Simulação)
```bash
npm run migrate:fields:dry
```

**Saída Esperada:**
```
🚀 DATABASE MIGRATION - Field Standardization (camelCase + Suffix)
================================================================================

📋 Configuração:
   - MongoDB URI: mongodb://localhost:27017/inmidia
   - Modo: DRY-RUN (simulação)
   - Batch Size: 100
   - Coleções: clientes, alugueis, placas, regioes, users, propostainternas, contratos

🔍 MODO DRY-RUN: Nenhuma alteração será feita

============================================================
Migrando coleção: clientes
============================================================
📊 Total de documentos: 1250
🔄 Documentos para migrar: 820

📝 [DRY-RUN] Documento 507f1f77bcf86cd799439011:
   $set: {
     "empresaId": ObjectId("6900ce7cd4411495a0cff9e0")
   }
   $unset: ["empresa", "id_empresa"]

[clientes] Processando: 820/820 (100.0%)

✅ Migração concluída:
   - Documentos processados: 820
   - Documentos simulados: 820
   - Duração: 2.34s

... [outras coleções] ...

================================================================================
📊 RELATÓRIO FINAL DE MIGRAÇÃO
================================================================================

📈 TOTAIS GERAIS:
   - Documentos totais: 5432
   - Documentos simulados: 3210
   - Erros: 0
   - Duração total: 8.92s
================================================================================

✅ Simulação concluída! Execute sem --dry-run para aplicar as mudanças.
```

#### 4️⃣ Analisar Resultados
**Perguntas a verificar:**
- ✅ Número de documentos a migrar está correto?
- ✅ Exemplos de transformação fazem sentido?
- ✅ Nenhum erro crítico?
- ✅ Tempo estimado é aceitável?

**Se tudo OK → Prosseguir para execução real**

#### 5️⃣ Execução Real
```bash
npm run migrate:fields
```

**Saída Esperada:**
```
⚠️  ATENÇÃO: Esta operação modificará dados no banco!
   Execute com --dry-run primeiro para validar.

   Iniciando em 3 segundos... (Ctrl+C para cancelar)

🔌 Conectando ao MongoDB...
✅ Conectado com sucesso!

============================================================
Migrando coleção: clientes
============================================================
📊 Total de documentos: 1250
🔄 Documentos para migrar: 820

[clientes] Processando: 820/820 (100.0%)

✅ Migração concluída:
   - Documentos processados: 820
   - Documentos migrados: 820
   - Duração: 3.12s

... [outras coleções] ...

📈 TOTAIS GERAIS:
   - Documentos totais: 5432
   - Documentos migrados: 3210
   - Duração total: 12.45s

✅ Migração concluída com sucesso!

🔌 Desconectado do MongoDB.
```

#### 6️⃣ Validação Manual
```bash
# Conectar ao MongoDB
mongo inmidia

# Verificar campos novos existem
> db.clientes.find({ empresaId: { $exists: true } }).count()
820  // ✅ Todos os documentos têm o campo novo

# Verificar campos antigos removidos
> db.clientes.find({ empresa: { $exists: true }, empresaId: { $exists: true } }).count()
0    // ✅ Campos antigos foram removidos

# Ver exemplo de documento migrado
> db.clientes.findOne({ empresaId: { $exists: true } })
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "nome": "Cliente Exemplo LTDA",
  "cpfCnpj": "12.345.678/0001-90",
  "empresaId": ObjectId("6900ce7cd4411495a0cff9e0"),  // ✅
  "telefone": "(11) 98765-4321",
  "createdAt": ISODate("2025-01-15T10:30:00Z"),
  "updatedAt": ISODate("2025-11-27T14:25:00Z")
}

# Verificar alugueis
> db.alugueis.findOne({ empresaId: { $exists: true } })
{
  "_id": ObjectId("..."),
  "empresaId": ObjectId("..."),  // ✅
  "clienteId": ObjectId("..."),  // ✅
  "placaId": ObjectId("..."),    // ✅
  "startDate": ISODate("2025-10-22T00:00:00Z"),
  "endDate": ISODate("2025-11-04T23:59:59Z"),
  ...
}
```

✅ **Validação OK → Migração Concluída!**

---

## 📋 Cenário 2: Migração com Erros

### **Situação:**
Alguns documentos têm ObjectIds inválidos ou campos vazios.

### **Dry-Run Mostra Warnings:**
```bash
npm run migrate:fields:dry
```

**Saída com Warnings:**
```
============================================================
Migrando coleção: clientes
============================================================
📊 Total de documentos: 1250
🔄 Documentos para migrar: 820

[clientes] Processando: 100/820 (12.2%)

⚠️  ObjectId inválido em clientes._id=507f..., campo=empresa
⚠️  ObjectId inválido em clientes._id=609a..., campo=id_empresa

[clientes] Processando: 820/820 (100.0%)

✅ Migração concluída:
   - Documentos processados: 820
   - Documentos simulados: 818
   - Erros: 2
```

### **Ação Requerida:**
```javascript
// Conectar ao MongoDB e corrigir manualmente
mongo inmidia

// Encontrar documentos problemáticos
db.clientes.find({
  $or: [
    { empresa: { $type: "string" } },  // Strings vazias
    { empresa: null },
    { empresa: "" }
  ]
})

// Opção 1: Deletar documentos inválidos (se não forem importantes)
db.clientes.deleteMany({
  _id: { $in: [
    ObjectId("507f..."),
    ObjectId("609a...")
  ]}
})

// Opção 2: Corrigir manualmente
db.clientes.updateOne(
  { _id: ObjectId("507f...") },
  { $set: { empresa: ObjectId("6900ce7cd4411495a0cff9e0") } }
)
```

Após correção → Executar migração novamente.

---

## 📋 Cenário 3: Migração Parcial (Apenas Uma Coleção)

### **Situação:**
Quer migrar apenas `clientes` para testar.

### **Modificar Script Temporariamente:**
```typescript
// migrate-database-suffix.ts (linha ~100)

// Comentar coleções não desejadas
const COLLECTION_MAPPINGS: Record<string, FieldMapping[]> = {
  clientes: [
    { oldField: 'empresa', newField: 'empresaId', type: 'ObjectId' },
  ],
  // alugueis: [...],  // ← Comentado
  // placas: [...],    // ← Comentado
  // ...
};
```

**Executar:**
```bash
npm run migrate:fields:dry  # Validar
npm run migrate:fields      # Executar
```

---

## 📋 Cenário 4: Rollback (Reverter Migração)

### **Situação:**
Algo deu errado, precisa voltar ao estado anterior.

### **Opção 1: Restaurar Backup Completo**
```bash
# Localizar backup
ls -lh backup-*/

# Restaurar (ATENÇÃO: Sobrescreve banco atual)
mongorestore --uri="mongodb://localhost:27017/inmidia" --drop backup-20251127-143000/

# Verificar
mongo inmidia --eval "db.clientes.findOne()"
```

### **Opção 2: Rollback Manual (Script)**
```javascript
// rollback-migracao.js
const mongoose = require('mongoose');

async function rollback() {
  await mongoose.connect('mongodb://localhost:27017/inmidia');
  
  const db = mongoose.connection.db;
  
  // Clientes: empresaId → empresa
  const clientes = await db.collection('clientes').find({ empresaId: { $exists: true } }).toArray();
  
  for (const doc of clientes) {
    await db.collection('clientes').updateOne(
      { _id: doc._id },
      { 
        $set: { empresa: doc.empresaId },
        $unset: { empresaId: "" }
      }
    );
  }
  
  console.log(`✅ Rollback de ${clientes.length} clientes concluído`);
  
  // Repetir para outras coleções...
  
  await mongoose.disconnect();
}

rollback().catch(console.error);
```

**Executar:**
```bash
node rollback-migracao.js
```

---

## 📋 Cenário 5: Migração em Produção

### **Situação:**
Banco de dados grande (100k+ documentos), produção ativa.

### **Recomendações:**

#### 1️⃣ Planejar Janela de Manutenção
```
🕐 Horário: 02:00 - 04:00 (baixo tráfego)
⏱️ Tempo estimado: 30-60 minutos
👥 Notificar usuários com antecedência
```

#### 2️⃣ Executar em Staging Primeiro
```bash
# Clone banco de produção para staging
mongodump --uri="mongodb://prod" --out=backup-prod
mongorestore --uri="mongodb://staging" backup-prod

# Testar migração completa em staging
cd BECKEND
npm run migrate:fields:dry -- --uri="mongodb://staging"
npm run migrate:fields -- --uri="mongodb://staging"

# Validar aplicação funciona
npm run dev
# Testar frontend, APIs, etc
```

#### 3️⃣ Migração Produção (Com Monitoramento)
```bash
# Backup de produção
mongodump --uri="mongodb://prod" --out=backup-prod-$(date +%Y%m%d-%H%M%S)

# Executar migração
npm run migrate:fields -- --uri="mongodb://prod" > migration.log 2>&1 &

# Monitorar em tempo real
tail -f migration.log

# Verificar carga do servidor
htop  # CPU/Memory
mongostat  # MongoDB stats
```

#### 4️⃣ Validação Pós-Migração
```bash
# Testes automáticos
npm run test

# Smoke tests manuais
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/clientes?empresaId=...

# Verificar logs de erro
tail -f logs/error.log
```

#### 5️⃣ Plano de Contingência
```bash
# Se algo falhar:
# 1. Parar aplicação
pm2 stop all

# 2. Restaurar backup
mongorestore --drop --uri="mongodb://prod" backup-prod-TIMESTAMP/

# 3. Reiniciar aplicação
pm2 start all

# 4. Investigar causa raiz
cat migration.log | grep ERROR
```

---

## 📊 Checklist Pré-Migração

Use esta checklist antes de executar em qualquer ambiente:

### **Preparação**
- [ ] Código Backend está na branch correta (master/main)
- [ ] Variável `MONGO_URI` configurada corretamente no `.env`
- [ ] Backup completo do banco de dados criado
- [ ] Backup verificado (pode ser restaurado)
- [ ] Espaço em disco suficiente (2x tamanho do banco)

### **Validação**
- [ ] Dry-run executado sem erros críticos
- [ ] Número de documentos a migrar está correto
- [ ] Exemplos de transformação revisados
- [ ] Tempo estimado é aceitável

### **Comunicação (Produção)**
- [ ] Usuários notificados (janela de manutenção)
- [ ] Time técnico de sobreaviso
- [ ] Plano de rollback documentado
- [ ] Monitoramento preparado

### **Execução**
- [ ] Migração executada em staging primeiro
- [ ] Testes completos em staging bem-sucedidos
- [ ] Frontend refatorado e testado
- [ ] Logs de migração salvos
- [ ] Validação manual concluída

### **Pós-Migração**
- [ ] Aplicação reiniciada
- [ ] Testes automáticos passaram
- [ ] Testes manuais (smoke tests) OK
- [ ] Monitoramento sem alertas
- [ ] Backup pós-migração criado
- [ ] Documentação atualizada

---

## 🚨 Solução de Problemas

### Erro: "Cannot connect to MongoDB"
```bash
# Verificar se MongoDB está rodando
sudo systemctl status mongod  # Linux
net start MongoDB             # Windows

# Testar conexão manual
mongo $MONGO_URI --eval "db.stats()"
```

### Erro: "Out of Memory"
```bash
# Aumentar batch size
# Editar migrate-database-suffix.ts
const BATCH_SIZE = 50;  // Reduzir de 100 para 50
```

### Erro: "Duplicate Key Error"
```javascript
// Verificar índices únicos
db.clientes.getIndexes()

// Se houver índice em campo antigo, removê-lo
db.clientes.dropIndex("empresa_1")
```

---

## 📞 Suporte

**Documentação Completa:**
- Sumário Executivo: `SUMARIO_EXECUTIVO.md`
- Relatório Backend: `BECKEND/docs/BACKEND_STANDARDIZATION_REPORT.md`
- README Migração: `BECKEND/scripts/README_MIGRATION.md`
- Guia Frontend: `REACT/docs/FRONTEND_REFACTORING_GUIDE.md`

**Em Caso de Dúvidas:**
1. Consultar documentação acima
2. Executar dry-run e analisar logs
3. Testar em ambiente local/staging primeiro
4. Criar backup SEMPRE antes de executar

---

**Última Atualização:** 27/11/2025  
**Versão:** 1.0.0
