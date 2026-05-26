"use client"

import * as React from "react"
import {
  Layers,
  FileText,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
} from "lucide-react"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { KPICard, ProgressBar } from "@/components/dashboard/kpi-card"
import { AlertPanel, type Alert } from "@/components/dashboard/alert-panel"
import { ActivityFeed, QuickStats, type ActivityItem } from "@/components/dashboard/activity-feed"
import { DataTable, StatusBadge, type Column } from "@/components/dashboard/data-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// Mock data for demonstration
const mockAlerts: Alert[] = [
  {
    id: "1",
    title: "Contrato vencendo em 7 dias",
    description: "Contrato #CTR-2024-0456 com Magazine Luiza vence em 15/06/2024",
    severity: "warning",
    timestamp: "5 minutos atras",
    category: "Contratos",
    actionLabel: "Ver contrato",
    actionHref: "/dashboard/contratos/456",
  },
  {
    id: "2",
    title: "Placa sem campanha ativa",
    description: "Placa BR-040-KM125 esta disponivel ha mais de 30 dias",
    severity: "critical",
    timestamp: "2 horas atras",
    category: "Placas",
    actionLabel: "Atribuir campanha",
    actionHref: "/dashboard/placas/125",
  },
  {
    id: "3",
    title: "Novo cliente cadastrado",
    description: "Americanas foi adicionada a base de clientes",
    severity: "success",
    timestamp: "3 horas atras",
    category: "Clientes",
  },
  {
    id: "4",
    title: "Manutencao programada",
    description: "Placa SP-BR-101-KM80 tera manutencao dia 20/06",
    severity: "info",
    timestamp: "1 dia atras",
    category: "Manutencao",
  },
]

const mockActivities: ActivityItem[] = [
  {
    id: "1",
    type: "contract",
    title: "Contrato renovado",
    description: "Contrato #CTR-2024-0789 renovado por mais 12 meses",
    timestamp: "Agora",
    user: "Maria Santos",
  },
  {
    id: "2",
    type: "campaign",
    title: "Campanha iniciada",
    description: "Campanha \"Black Friday 2024\" ativada em 15 placas",
    timestamp: "30 min atras",
    user: "Joao Silva",
  },
  {
    id: "3",
    type: "client",
    title: "Cliente atualizado",
    description: "Dados de contato da Americanas atualizados",
    timestamp: "2 horas atras",
    user: "Carlos Oliveira",
  },
  {
    id: "4",
    type: "contract",
    title: "Proposta enviada",
    description: "Proposta comercial enviada para Casas Bahia",
    timestamp: "4 horas atras",
    user: "Ana Costa",
  },
  {
    id: "5",
    type: "system",
    title: "Backup realizado",
    description: "Backup automatico do sistema concluido",
    timestamp: "6 horas atras",
  },
]

interface PlacaData {
  id: string
  codigo: string
  localizacao: string
  status: string
  ocupacao: string
  cliente: string
  valorMensal: string
}

const mockPlacas: PlacaData[] = [
  {
    id: "1",
    codigo: "BR-040-KM125",
    localizacao: "Rodovia BR-040, Km 125",
    status: "Ocupada",
    ocupacao: "Magazine Luiza",
    cliente: "Magazine Luiza",
    valorMensal: "R$ 8.500",
  },
  {
    id: "2",
    codigo: "SP-BR-101-KM80",
    localizacao: "Rodovia BR-101, Km 80",
    status: "Manutencao",
    ocupacao: "-",
    cliente: "-",
    valorMensal: "R$ 12.000",
  },
  {
    id: "3",
    codigo: "RJ-AV-BRASIL-500",
    localizacao: "Av. Brasil, 500 - RJ",
    status: "Disponivel",
    ocupacao: "-",
    cliente: "-",
    valorMensal: "R$ 15.000",
  },
  {
    id: "4",
    codigo: "MG-BR-381-KM45",
    localizacao: "Rodovia BR-381, Km 45",
    status: "Ocupada",
    ocupacao: "Coca-Cola",
    cliente: "Coca-Cola Brasil",
    valorMensal: "R$ 9.200",
  },
  {
    id: "5",
    codigo: "PR-BR-376-KM200",
    localizacao: "Rodovia BR-376, Km 200",
    status: "Ocupada",
    ocupacao: "Ambev",
    cliente: "Ambev S.A.",
    valorMensal: "R$ 7.800",
  },
]

const placasColumns: Column<PlacaData>[] = [
  { key: "codigo", title: "Codigo", sortable: true },
  { key: "localizacao", title: "Localizacao", sortable: true },
  {
    key: "status",
    title: "Status",
    sortable: true,
    render: (value) => {
      const status = String(value)
      const variant =
        status === "Ocupada"
          ? "success"
          : status === "Disponivel"
          ? "warning"
          : status === "Manutencao"
          ? "destructive"
          : "outline"
      return <StatusBadge status={status} variant={variant} />
    },
  },
  { key: "cliente", title: "Cliente", sortable: true },
  { key: "valorMensal", title: "Valor Mensal", sortable: true },
]

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visao geral do sistema de midia exterior
          </p>
        </div>

        {/* Health Status Banner */}
        <Card className="border-success/20 bg-success/5">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-success">Sistema Operacional</p>
              <p className="text-xs text-muted-foreground">
                Todos os sistemas funcionando normalmente. Ultima sincronizacao: 2 minutos atras
              </p>
            </div>
            <Badge variant="outline" className="border-success/20 text-success">
              99.9% uptime
            </Badge>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <QuickStats
          stats={[
            { label: "Placas Ativas", value: 156, change: 5.2 },
            { label: "Taxa Ocupacao", value: "87%", change: 2.3 },
            { label: "Receita Mensal", value: "R$ 1.2M", change: 8.1 },
            { label: "Contratos Ativos", value: 48, change: -1.5 },
          ]}
        />

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total de Placas"
            value={156}
            subtitle="12 regioes"
            trend={{ value: 5.2, label: "vs. mes anterior" }}
            icon={Layers}
            iconColor="primary"
            sparklineData={[45, 52, 49, 63, 55, 70, 65, 80, 75, 90, 85, 95]}
          />
          <KPICard
            title="Contratos Ativos"
            value={48}
            subtitle="32 clientes"
            trend={{ value: 12.5, label: "vs. mes anterior" }}
            icon={FileText}
            iconColor="success"
            sparklineData={[20, 25, 22, 30, 28, 35, 32, 40, 38, 45, 42, 48]}
          />
          <KPICard
            title="Receita Ativa"
            value="R$ 1.2M"
            subtitle="faturamento mensal"
            trend={{ value: 8.1, label: "vs. mes anterior" }}
            icon={DollarSign}
            iconColor="success"
            sparklineData={[800, 850, 820, 900, 880, 950, 920, 1000, 980, 1100, 1050, 1200]}
          />
          <KPICard
            title="Alertas Pendentes"
            value={5}
            subtitle="2 criticos"
            trend={{ value: -15, label: "vs. semana anterior" }}
            icon={AlertTriangle}
            iconColor="warning"
            sparklineData={[12, 10, 8, 11, 9, 7, 8, 6, 7, 5, 6, 5]}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Alerts & Activity */}
          <div className="space-y-6 lg:col-span-1">
            <AlertPanel alerts={mockAlerts} maxItems={4} />
            <ActivityFeed activities={mockActivities} maxItems={5} />
          </div>

          {/* Right Column - Data & Charts */}
          <div className="space-y-6 lg:col-span-2">
            {/* Occupancy Overview */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Ocupacao por Regiao
                  </CardTitle>
                  <Badge variant="secondary">Este mes</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProgressBar
                  value={92}
                  label="Sao Paulo"
                  color="success"
                  size="md"
                />
                <ProgressBar
                  value={85}
                  label="Rio de Janeiro"
                  color="success"
                  size="md"
                />
                <ProgressBar
                  value={78}
                  label="Minas Gerais"
                  color="primary"
                  size="md"
                />
                <ProgressBar
                  value={65}
                  label="Parana"
                  color="warning"
                  size="md"
                />
                <ProgressBar
                  value={45}
                  label="Bahia"
                  color="destructive"
                  size="md"
                />
              </CardContent>
            </Card>

            {/* Placas Table */}
            <DataTable
              title="Placas Recentes"
              columns={placasColumns}
              data={mockPlacas}
              searchPlaceholder="Buscar placas..."
            />
          </div>
        </div>

        {/* Map Preview Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-primary" />
                Distribuicao Geografica
              </CardTitle>
              <Badge variant="outline">156 placas</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20">
              <div className="text-center">
                <MapPin className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Mapa interativo de distribuicao de placas
                </p>
                <p className="text-xs text-muted-foreground">
                  Clique para expandir visualizacao
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
