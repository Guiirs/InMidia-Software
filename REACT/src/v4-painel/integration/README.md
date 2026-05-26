# Integration Layer — V4 Painel

Esta pasta contém os **contratos de integração futura** do v4-painel.

## O que são contratos?

Contratos definem o formato exato de dados que os providers reais deverão fornecer para cada página. Eles:

- **Documentam a interface esperada** pela UI sem implementar nada
- **Classificam cada campo** como `existente`, `derivado`, `parcial` ou `novo`
- **Listam os endpoints necessários** com status atual no backend
- **Servem como especificação** aprovada antes da implementação real

## Como usar

1. **UI Developer**: leia o contrato da página que deseja integrar
2. **Backend Developer**: implemente os campos marcados como `novo` ou `parcial`
3. **Tech Lead**: aprove o contrato antes de qualquer implementação começar

## Fluxo de integração

```
Mock (atual) → Contrato aprovado → Backend implementa → Provider real substitui mock → Flag ativado
```

## Status por página

| Página      | Contrato | Campos novos | Campos existentes | Complexidade |
|-------------|----------|-------------|-------------------|--------------|
| Dashboard   | ✅       | 6           | 8                 | Alta         |
| Inventory   | ✅       | 5           | 10                | Média        |
| Operations  | ✅       | 12          | 3                 | Alta         |
| Commercial  | ✅       | 8           | 4                 | Alta         |
| Contracts   | ✅       | 5           | 7                 | Média        |
| Reports     | ✅       | 4           | 5                 | Baixa        |
| Alerts      | ✅       | 10          | 2                 | Alta         |

## Regra fundamental

**Nunca conectar dados reais antes de ter o contrato aprovado.**
**Nunca alterar a UI para acomodar formato de dado — o provider adapta o dado para a UI.**
