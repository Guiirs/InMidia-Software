import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { fetchPlacas, fetchRegioes } from '../../services';
import { QUERY_KEYS } from '../../constants/queryKeys';
import InventoryV4 from '../pages/inventory/InventoryV4';

import {
  bridgePlacasToInventoryPayload,
  buildInventoryV4QueryKey,
  buildInventoryV4SearchParams,
  isInventoryV4RouteEnabled
} from './inventoryV4Bridge';

import './InventoryV4Route.css';

const DEFAULT_FILTERS = {
  regiao_id: 'todas',
  disponibilidade: 'todos',
  search: ''
};

export default function InventoryV4Route() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const routeEnabled = isInventoryV4RouteEnabled();

  const regioesQuery = useQuery({
    queryKey: QUERY_KEYS.regioes.list,
    queryFn: fetchRegioes,
    staleTime: 1000 * 60 * 60,
    placeholderData: []
  });

  const placasQuery = useQuery({
    queryKey: buildInventoryV4QueryKey(filters, currentPage),
    queryFn: async () => {
      const params = buildInventoryV4SearchParams(filters, currentPage);
      return fetchPlacas(params);
    },
    placeholderData: (previousData) => previousData
  });

  const bridge = useMemo(() => {
    return bridgePlacasToInventoryPayload(placasQuery.data);
  }, [placasQuery.data]);

  const handleServerFilterChange = (name, value) => {
    setFilters((previous) => ({
      ...previous,
      [name]: value
    }));
    setCurrentPage(1);
  };

  const handleServerSearchChange = (value) => {
    setFilters((previous) => ({
      ...previous,
      search: value
    }));
    setCurrentPage(1);
  };

  const handlePageChange = (nextPage) => {
    const totalPages = bridge.pagination?.totalPages || 1;
    if (nextPage < 1 || nextPage > totalPages) {
      return;
    }
    setCurrentPage(nextPage);
  };

  if (!routeEnabled) {
    return <Navigate to="/placas" replace />;
  }

  return (
    <div className="v4-inventory-route">
      <InventoryV4
        mode="real-readonly"
        inputPayload={bridge.inventoryPayload}
        externalLoading={regioesQuery.isLoading || placasQuery.isLoading}
        externalError={placasQuery.isError ? placasQuery.error : null}
        serverFilters={filters}
        onServerFilterChange={handleServerFilterChange}
        onServerSearchChange={handleServerSearchChange}
        regionOptionsRaw={regioesQuery.data || []}
        pagination={bridge.pagination}
        onPageChange={handlePageChange}
        inputAlreadyAdapted
        syncLabel="Leitura real read-only"
      />
    </div>
  );
}
