let inventoryBoardsQuery = {};

export function setInventoryBoardsQuery(query = {}) {
  inventoryBoardsQuery = { ...query };
}

export function getInventoryBoardsQuery() {
  return { ...inventoryBoardsQuery };
}
