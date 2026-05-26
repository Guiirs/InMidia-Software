/**
 * SCRIPT DE CORREÇÃO: Remove índices legados e completa migração
 * 
 * Problema: Índices únicos compostos com campos antigos impedem a migração
 * Solução: Remove índices antigos e refaz migração dos documentos que falharam
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inmidia';

async function fixIndexesAndRetry() {
  console.log('\n🔧 CORREÇÃO DE ÍNDICES E MIGRAÇÃO');
  console.log('=====================================\n');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado ao MongoDB\n');

    const db = mongoose.connection.db;

    // ============================================================
    // 1. REMOVER ÍNDICES LEGADOS
    // ============================================================
    
    console.log('📋 Removendo índices legados...\n');

    // CLIENTES: Remover TODOS os índices com "empresa"
    const clientesIndexes = await db.collection('clientes').indexes();
    for (const index of clientesIndexes) {
      if (index.name !== '_id_' && (index.key.empresa !== undefined || index.name.includes('empresa_'))) {
        try {
          await db.collection('clientes').dropIndex(index.name);
          console.log(`   ✅ clientes: Removido índice ${index.name}`);
        } catch (err) {
          console.log(`   ⚠️  clientes: Erro ao remover ${index.name} - ${err.message}`);
        }
      }
    }

    // PLACAS: Remover TODOS os índices com "empresa" ou "regiao"
    const placasIndexes = await db.collection('placas').indexes();
    for (const index of placasIndexes) {
      if (index.name !== '_id_' && (index.key.empresa !== undefined || index.key.regiao !== undefined || 
          index.name.includes('empresa_') || index.name.includes('regiao_'))) {
        try {
          await db.collection('placas').dropIndex(index.name);
          console.log(`   ✅ placas: Removido índice ${index.name}`);
        } catch (err) {
          console.log(`   ⚠️  placas: Erro ao remover ${index.name} - ${err.message}`);
        }
      }
    }

    console.log('\n✅ Índices legados removidos!\n');

    // ============================================================
    // 2. COMPLETAR MIGRAÇÃO DOS DOCUMENTOS QUE FALHARAM
    // ============================================================
    
    console.log('📋 Completando migração dos documentos que falharam...\n');

    // CLIENTES: Migrar documento 69012617988a756860dcb08b
    const clientesFail = await db.collection('clientes').find({
      _id: new mongoose.Types.ObjectId('69012617988a756860dcb08b')
    }).toArray();

    if (clientesFail.length > 0 && clientesFail[0].empresa) {
      await db.collection('clientes').updateOne(
        { _id: new mongoose.Types.ObjectId('69012617988a756860dcb08b') },
        {
          $set: { empresaId: new mongoose.Types.ObjectId(clientesFail[0].empresa) },
          $unset: { empresa: '' }
        }
      );
      console.log('   ✅ Cliente 69012617988a756860dcb08b migrado');
    }

    // PLACAS: Migrar 5 documentos que falharam
    const placaIds = [
      '69024a38b14ecda50799ff2a',
      '69024b3eb14ecda50799ff79',
      '69024ba5b14ecda50799ff8a',
      '69024be4b14ecda50799ff9b',
      '69024c0cb14ecda50799ffab'
    ];

    for (const placaId of placaIds) {
      const placa = await db.collection('placas').findOne({
        _id: new mongoose.Types.ObjectId(placaId)
      });

      if (placa && (placa.empresa || placa.regiao)) {
        const update = { $unset: {} };
        if (placa.empresa) {
          update.$set = update.$set || {};
          update.$set.empresaId = new mongoose.Types.ObjectId(placa.empresa);
          update.$unset.empresa = '';
        }
        if (placa.regiao) {
          update.$set = update.$set || {};
          update.$set.regiaoId = new mongoose.Types.ObjectId(placa.regiao);
          update.$unset.regiao = '';
        }

        await db.collection('placas').updateOne(
          { _id: new mongoose.Types.ObjectId(placaId) },
          update
        );
        console.log(`   ✅ Placa ${placaId} migrada`);
      }
    }

    console.log('\n✅ CORREÇÃO COMPLETA!\n');

    // ============================================================
    // 3. RECRIAR ÍNDICES COM NOVOS CAMPOS
    // ============================================================
    
    console.log('📋 Criando índices novos...\n');

    // CLIENTES: empresaId_1_cnpj_1
    await db.collection('clientes').createIndex(
      { empresaId: 1, cnpj: 1 },
      { unique: true, name: 'empresaId_1_cnpj_1' }
    );
    console.log('   ✅ clientes: Criado índice empresaId_1_cnpj_1');

    // PLACAS: empresaId_1_regiaoId_1_numero_placa_1
    await db.collection('placas').createIndex(
      { empresaId: 1, regiaoId: 1, numero_placa: 1 },
      { unique: true, name: 'empresaId_1_regiaoId_1_numero_placa_1' }
    );
    console.log('   ✅ placas: Criado índice empresaId_1_regiaoId_1_numero_placa_1');

    console.log('\n✅ Novos índices criados!\n');

    // ============================================================
    // 4. VALIDAÇÃO FINAL
    // ============================================================
    
    console.log('📋 Validação final...\n');

    const clientesComEmpresa = await db.collection('clientes').countDocuments({ empresa: { $exists: true } });
    const placasComEmpresa = await db.collection('placas').countDocuments({ empresa: { $exists: true } });
    const placasComRegiao = await db.collection('placas').countDocuments({ regiao: { $exists: true } });

    console.log(`   Clientes com campo "empresa": ${clientesComEmpresa}`);
    console.log(`   Placas com campo "empresa": ${placasComEmpresa}`);
    console.log(`   Placas com campo "regiao": ${placasComRegiao}\n`);

    if (clientesComEmpresa === 0 && placasComEmpresa === 0 && placasComRegiao === 0) {
      console.log('✅ MIGRAÇÃO 100% COMPLETA! Todos os campos legados foram removidos.\n');
    } else {
      console.log('⚠️  Ainda existem campos legados. Verifique manualmente.\n');
    }

  } catch (error) {
    console.error('❌ ERRO:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado do MongoDB.\n');
  }
}

fixIndexesAndRetry().catch(console.error);
