/**
 * SCRIPT DE BACKUP MONGODB (sem mongodump)
 * Usa Mongoose para exportar coleções para JSON
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/inmidia';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
const backupDir = path.join(__dirname, '..', 'backups', `backup-${timestamp}`);

async function createBackup() {
  console.log('\n🔒 INICIANDO BACKUP DO MONGODB (via Mongoose)');
  console.log('==============================================\n');
  console.log(`📍 URI: ${MONGODB_URI.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`📁 Destino: ${backupDir}\n`);

  try {
    // Criar diretório de backup
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log('✅ Diretório de backup criado\n');
    }

    // Conectar ao MongoDB
    console.log('🔌 Conectando ao MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado com sucesso!\n');

    const db = mongoose.connection.db;
    
    // Listar todas as coleções disponíveis
    const collections = await db.listCollections().toArray();
    const availableCollections = collections.map(c => c.name);
    
    console.log(`📊 Coleções encontradas: ${availableCollections.length}`);
    console.log(`   ${availableCollections.join(', ')}\n`);

    let totalDocs = 0;
    let totalSize = 0;
    const stats = [];

    // Backup de cada coleção
    for (const collectionName of availableCollections) {
      try {
        console.log(`📦 Exportando: ${collectionName}...`);
        
        const collection = db.collection(collectionName);
        const docs = await collection.find({}).toArray();
        
        const filePath = path.join(backupDir, `${collectionName}.json`);
        const jsonData = JSON.stringify(docs, null, 2);
        
        fs.writeFileSync(filePath, jsonData, 'utf8');
        
        const fileSize = (Buffer.byteLength(jsonData) / 1024).toFixed(2);
        
        console.log(`   ✅ ${docs.length} documentos (${fileSize} KB)`);
        
        totalDocs += docs.length;
        totalSize += parseFloat(fileSize);
        
        stats.push({
          collection: collectionName,
          documents: docs.length,
          size: fileSize
        });
        
      } catch (error) {
        console.error(`   ⚠️  Erro ao exportar ${collectionName}:`, error.message);
      }
    }

    // Salvar metadados do backup
    const metadata = {
      timestamp: new Date().toISOString(),
      mongodbUri: MONGODB_URI.replace(/:[^:@]+@/, ':****@'),
      totalCollections: stats.length,
      totalDocuments: totalDocs,
      totalSizeKB: totalSize.toFixed(2),
      collections: stats
    };

    fs.writeFileSync(
      path.join(backupDir, 'backup-metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf8'
    );

    console.log('\n✅ BACKUP CONCLUÍDO COM SUCESSO!');
    console.log('================================\n');
    console.log(`📂 Localização: ${backupDir}`);
    console.log(`📊 Estatísticas:`);
    console.log(`   - Coleções: ${stats.length}`);
    console.log(`   - Documentos: ${totalDocs}`);
    console.log(`   - Tamanho: ${totalSize.toFixed(2)} KB\n`);

    console.log('📋 Detalhes por coleção:');
    stats.forEach(s => {
      console.log(`   ${s.collection.padEnd(20)} ${String(s.documents).padStart(6)} docs  ${String(s.size).padStart(8)} KB`);
    });

    console.log('\n✅ Agora você pode executar a migração com segurança!');
    console.log('   npm run migrate:fields:dry   # Simulação');
    console.log('   npm run migrate:fields        # Execução real\n');

  } catch (error) {
    console.error('\n❌ ERRO ao criar backup:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado do MongoDB.\n');
  }
}

// Executar backup
createBackup().catch(console.error);
