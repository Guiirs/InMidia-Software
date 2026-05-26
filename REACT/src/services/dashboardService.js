import apiClient from './apiClient';
import {
  normalizeDashboardOverview,
  normalizeMostRentedBoards,
  normalizeIdleBoards,
  normalizeRegionPerformance,
  normalizeSalesFunnel,
  normalizeDashboardAlerts,
} from '../adapters/dashboardAdapter';

export const fetchDashboardOverview = async () => {
  const response = await apiClient.get('/dashboard/overview');
  return normalizeDashboardOverview(response.data);
};

export const fetchMostRentedBoards = async () => {
  const response = await apiClient.get('/dashboard/placas-mais-alugadas');
  return normalizeMostRentedBoards(response.data);
};

export const fetchIdleBoards = async () => {
  const response = await apiClient.get('/dashboard/placas-paradas');
  return normalizeIdleBoards(response.data);
};

export const fetchRegionPerformance = async () => {
  const response = await apiClient.get('/dashboard/regioes-performance');
  return normalizeRegionPerformance(response.data);
};

export const fetchSalesFunnel = async () => {
  const response = await apiClient.get('/dashboard/funil-comercial');
  return normalizeSalesFunnel(response.data);
};

export const fetchDashboardAlerts = async () => {
  const response = await apiClient.get('/dashboard/alertas');
  return normalizeDashboardAlerts(response.data);
};
