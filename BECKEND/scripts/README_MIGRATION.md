# 🚀 Scripts de Migração do Banco de Dados

## 📁 Localização
`BECKEND/scripts/migrate-database-suffix.ts`

---

## 🎯 Propósito

Migra campos legados no MongoDB para o novo padrão **camelCase com sufixos explícitos**.

### Exemplos de Transformação:
| ❌ Antes (Legado) | ✅ Depois (Novo) |
|-------------------|------------------|
| `empresa` | `empresaId` |
| `id_empresa` | `empresaId` |
| `empresa_id` | `empresaId` |
| `cliente` | `clienteId` |
| `placa` | `placaId` |
| `regiao` | `regiaoId` |

---

## ⚙️ Configuração

### Pré-requisitos
- Node.js 16+
- TypeScript 4+
- ts-node instalado
- Conexão com MongoDB

### Variáveis de Ambiente
O script usa `MONGO_URI` do arquivo `.env`:

```bash
# .env
MONGO_URI=mongodb://localhost:27017/inmidia
```

---

## 🚀 Uso

### 1. Modo Simulação (Dry-Run) - SEMPRE EXECUTE PRIMEIRO!
```bash
npm run migrate:fields:dry
```

**O que faz:**
- ✅ Conecta ao banco de dados
- ✅ Analisa documentos que precisam migração
- ✅ Exibe exemplos de transformações
- ✅ Mostra estatísticas detalhadas
- ❌ **NÃO grava alterações**

**Saída exemplo:**
```
🔍 MODO DRY-RUN: Nenhuma alteração será feita

📁 clientes:
   - Total: 1250
   - Necessitavam migração: 820
   - Simulados: 820

📝 [DRY-RUN] Documento 507f1f77bcf86cd799439011:
   $set: {
     "empresaId": ObjectId("6900ce7cd4411495a0cff9e0")
   }
   $unset: ["empresa", "id_empresa"]
```

### 2. Execução Real (Produção)
```bash
npm run migrate:fields
```

**⚠️ ATENÇÃO:**
- Modifica dados no banco de dados
- Aguarda 3 segundos antes de iniciar (Ctrl+C para cancelar)
- Processa em lotes de 100 documentos
- Logs detalhados de progresso

**Saída exemplo:**
```
⚠️  ATENÇÃO: Esta operação modificará dados no banco!
   Iniciando em 3 segundos... (Ctrl+C para cancelar)

[clientes] Processando: 820/820 (100.0%)

✅ Migração concluída:
   - Documentos processados: 820
   - Documentos migrados: 820
   - Duração: 3.45s
```

### 3. Com URI Customizada
```bash
npm run migrate:fields -- --uri="mongodb://usuario:senha@host:27017/dbname"
```

---

## 🏗️ Arquitetura do Script

### Coleções Afetadas
```typescript
const COLLECTION_MAPPINGS = {
  clientes: [
    { oldField: 'empresa', newField: 'empresaId', type: 'ObjectId' },
    { oldField: 'id_empresa', newField: 'empresaId', type: 'ObjectId' },
  ],
  alugueis: [
    { oldField: 'empresa', newField: 'empresaId', type: 'ObjectId' },
    { oldField: 'cliente', newField: 'clienteId', type: 'ObjectId' },
    { oldField: 'placa', newField: 'placaId', type: 'ObjectId' },
  ],
  placas: [
    { oldField: 'empresa', newField: 'empresaId', type: 'ObjectId' },
    { oldField: 'regiao', newField: 'regiaoId', type: 'ObjectId' },
  ],
  // ... outras coleções
};
```

### Lógica de Processamento

1. **Busca documentos** com campos legados (`$or` query)
2. **Para cada documento:**
   - Verifica se campo novo já existe
   - Se não existir: copia valor do campo antigo
   - Valida ObjectIds
   - Remove campo antigo (`$unset`)
3. **Processa em lotes** (100 docs por vez)
4. **Logs detalhados** de progresso

### Segurança

**✅ Validações:**
- ObjectIds inválidos são ignorados (log de warning)
- Documentos já migrados são pulados
- Erros não interrompem todo o processo

**✅ Performance:**
- Batch size: 100 documentos
- Cursor MongoDB otimizado
- Não trava o banco

**❌ Não usa transações** (MongoDB standalone não suporta)

---

## 📊 Estatísticas e Relatórios

### Relatório Final Completo
```
📊 RELATÓRIO FINAL DE MIGRAÇÃO
==================================================

📁 clientes:
   - Total: 1250
   - Necessitavam migração: 820
   - Migrados: 820
   - Erros: 0

📁 alugueis:
   - Total: 5432
   - Necessitavam migração: 3210
   - Migrados: 3210
   - Erros: 2

... outras coleções ...

📈 TOTAIS GERAIS:
   - Documentos totais: 12450
   - Documentos migrados: 8932
   - Erros: 2
   - Duração total: 45.32s
```

---

## ⚠️ Problemas Comuns

### Erro: "ObjectId inválido"
```
⚠️ ObjectId inválido em clientes._id=507f..., campo=empresa
```

**Causa:** Campo contém string vazia ou valor inválido  
**Solução:** O script ignora e continua (documentado no log)

### Erro: "Conexão recusada"
```
❌ Erro fatal: connect ECONNREFUSED 127.0.0.1:27017
```

**Causa:** MongoDB não está rodando  
**Solução:**
```bash
# Windows
net start MongoDB

# Linux/Mac
sudo systemctl start mongod
```

### Erro: "Documento não encontrado"
**Causa:** Coleção foi renomeada/removida  
**Solução:** Atualizar `COLLECTION_MAPPINGS` no script

---

## 🔄 Rollback (Reverter Migração)

Caso precise reverter:

### Opção 1: Restaurar Backup
```bash
# Antes da migração (recomendado)
mongodump --uri="mongodb://..." --out=backup-pre-migration

# Para restaurar
mongorestore --uri="mongodb://..." backup-pre-migration
```

### Opção 2: Script Manual de Reversão
```javascript
// reverter-migracao.js
db.clientes.find({ empresaId: { $exists: true } }).forEach(doc => {
  db.clientes.updateOne(
    { _id: doc._id },
    { 
      $set: { empresa: doc.empresaId },
      $unset: { empresaId: "" }
    }
  );
});
```

---

## 📝 Logs

Todos os logs são exibidos no console com cores:

| Cor | Significado |
|-----|-------------|
| 🟢 Verde | Sucesso |
| 🔵 Azul | Informação |
| 🟡 Amarelo | Warning |
| 🔴 Vermelho | Erro |
| ⚫ Cinza | Debug |

---

## 🧪 Testes

### Testar em Ambiente Local
```bash
# 1. Clone banco de produção
mongodump --uri="mongodb://producao" --out=backup-prod
mongorestore --uri="mongodb://localhost:27017/test" backup-prod

# 2. Execute dry-run no banco de teste
npm run migrate:fields:dry -- --uri="mongodb://localhost:27017/test"

# 3. Execute migração real
npm run migrate:fields -- --uri="mongodb://localhost:27017/test"

# 4. Valide os resultados
mongo test
> db.clientes.find({ empresaId: { $exists: true } }).count()
> db.clientes.find({ empresa: { $exists: true } }).count() // Deve ser 0
```

---

## 📚 Referências

- [Mongoose Schema Virtuals](https://mongoosejs.com/docs/guide.html#virtuals)
- [MongoDB Update Operators](https://docs.mongodb.com/manual/reference/operator/update/)
- [TypeScript Migration Guide](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html)

---

## 🆘 Suporte

Em caso de problemas:
1. Execute `npm run migrate:fields:dry` e analise os logs
2. Verifique conexão com MongoDB
3. Confirme que `.env` está configurado
4. Consulte `BACKEND_STANDARDIZATION_REPORT.md`

---

**Última Atualização:** 27/11/2025  
**Versão:** 1.0.0  
**Compatibilidade:** MongoDB 4.4+, Node.js 16+
