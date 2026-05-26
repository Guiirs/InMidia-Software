# Sistema de Geração de Contratos em Excel

## Visão Geral

Este sistema automatiza a geração de contratos em Excel quando uma Proposta Interna (PI) é finalizada. Utiliza um template Excel (CONTRATO.xlsx) e preenche automaticamente os dados do cliente, campanha e valores financeiros.

## Funcionalidades

### Geração de Contrato Excel
- **Endpoint**: `GET /api/v1/contratos/:id/excel`
- **Descrição**: Gera e baixa um contrato em Excel preenchido com dados da PI
- **Autenticação**: Necessária (Bearer Token)

### Como Usar

1. **Criar um Contrato**: Primeiro crie um contrato a partir de uma PI
   ```bash
   POST /api/v1/contratos
   {
     "piId": "ID_DA_PI"
   }
   ```

2. **Gerar Excel**: Baixe o contrato em Excel
   ```bash
   GET /api/v1/contratos/{contrato_id}/excel
   ```

## Configuração do Template

### Localização do Template
- **Caminho**: `templates/CONTRATO.xlsx`
- **Formato**: Arquivo Excel (.xlsx) com layout visual preservado

### Mapeamento de Células

O sistema mapeia os dados da PI para células específicas do Excel. **IMPORTANTE**: Você deve ajustar estes endereços de células conforme seu template real.

```javascript
const cellMapping = {
  razaoSocial: 'C3',        // Razão Social do Anunciante
  endereco: 'C4',           // Endereço
  cnpj: 'C5',               // CNPJ
  tituloCampanha: 'B8',     // Título da Campanha
  produto: 'B9',             // Produto
  periodo: 'B10',           // Período (Bisemana)
  condicoesPagamento: 'B11', // Condições de Pagamento
  descricaoPlacas: 'B13',   // Descrição das placas (texto livre)
  valorProducao: 'F18',     // Valor Produção
  valorVeiculacao: 'F19',   // Valor Veiculação
  valorTotal: 'F20'         // Valor Total
};
```

### Como Ajustar o Mapeamento

1. Abra seu arquivo `CONTRATO.xlsx` no Excel
2. Identifique as células corretas para cada campo
3. Atualize os valores no código em `src/modules/contratos/contrato.service.ts`
4. Teste a geração do contrato

### Estrutura dos Dados

O sistema espera os seguintes dados da PI:

```javascript
{
  cliente: {
    razaoSocial: string,
    endereco: string,
    cnpj: string
  },
  campanha: {
    titulo: string,
    produto: string,
    periodo: string, // Ex: "Bisemana 1-2025"
    condicoesPagamento: string
  },
  placas: [{
    numero: string,
    localizacao: string
  }],
  financeiro: {
    valorProducao: number,
    valorVeiculacao: number,
    valorTotal: number
  }
}
```

## Dependências

- `xlsx-populate`: Para manipulação de arquivos Excel mantendo formatação

## Instalação

```bash
npm install xlsx-populate
```

## Tratamento de Erros

- **404**: Contrato ou PI não encontrada
- **500**: Erro interno (template não encontrado, erro de processamento)

## Logs

Os logs são registrados com os seguintes prefixos:
- `[ContratoService]`: Operações do service
- `[ContratoController]`: Requisições HTTP

## Próximos Passos

1. Coloque seu arquivo `CONTRATO.xlsx` na pasta `templates/`
2. Ajuste o mapeamento de células conforme seu template
3. Teste a geração de contratos
4. Configure a automação para gerar contratos quando PIs forem finalizadas