// Exemplo de uso da API de geração de contratos Excel

// 1. Primeiro, crie um contrato a partir de uma PI
const criarContrato = async () => {
  const response = await fetch('/api/v1/contratos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_TOKEN_HERE'
    },
    body: JSON.stringify({
      piId: 'ID_DA_PI_AQUI'
    })
  });

  const contrato = await response.json();
  console.log('Contrato criado:', contrato);
  return contrato.id;
};

// 2. Depois, gere o Excel do contrato
const gerarExcelContrato = async (contratoId) => {
  const response = await fetch(`/api/v1/contratos/${contratoId}/excel`, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN_HERE'
    }
  });

  if (response.ok) {
    // O navegador fará o download automático do arquivo Excel
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contrato_${contratoId}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } else {
    console.error('Erro ao gerar Excel:', response.statusText);
  }
};

// Exemplo de uso completo
const exemploUso = async () => {
  try {
    // Criar contrato
    const contratoId = await criarContrato();

    // Gerar Excel
    await gerarExcelContrato(contratoId);

    console.log('Contrato Excel gerado com sucesso!');
  } catch (error) {
    console.error('Erro:', error);
  }
};

// Chamada do exemplo
// exemploUso();