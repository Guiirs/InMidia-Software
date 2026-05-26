const mongoose = require('mongoose');
require('dotenv').config();

async function checkPlacas() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/api_db');

    const Placa = mongoose.model('Placa', new mongoose.Schema({}, { strict: false }));

    const total = await Placa.countDocuments();
    const disponiveis = await Placa.countDocuments({ disponivel: true });
    const porEmpresa = await Placa.aggregate([
      { $group: { _id: '$empresa', count: { $sum: 1 } } }
    ]);

    console.log('Total de placas:', total);
    console.log('Placas disponíveis:', disponiveis);
    console.log('Placas por empresa:', porEmpresa);

    // Verificar se há placas sem empresa
    const semEmpresa = await Placa.countDocuments({ empresa: { $exists: false } });
    const empresaNull = await Placa.countDocuments({ empresa: null });
    console.log('Placas sem empresa definida:', semEmpresa);
    console.log('Placas com empresa null:', empresaNull);

    // Pegar IDs das empresas que têm placas
    const empresasComPlacas = porEmpresa.map(e => e._id).filter(id => id);
    console.log('Empresas que têm placas:', empresasComPlacas);

    process.exit(0);
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

checkPlacas();