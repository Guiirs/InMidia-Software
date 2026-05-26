"use client"

import * as React from "react"
import {
  Layers,
  Plus,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  MapPin,
  Building2,
  Calendar,
  DollarSign,
} from "lucide-react"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { DataTable, StatusBadge, type Column } from "@/components/dashboard/data-table"
import { KPICard } from "@/components/dashboard/kpi-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PlacaData {
  id: string
  codigo: string
  tipo: string
  localizacao: string
  cidade: string
  uf: string
  status: string
  cliente: string
  valorMensal: string
  contratoFim: string
  dimensoes: string
}

const mockPlacas: PlacaData[] = [
  { id: "1", codigo: "BR-040-KM125", tipo: "Outdoor", localizacao: "Rodovia BR-040, Km 125", cidade: "Belo Horizonte", uf: "MG", status: "Ocupada", cliente: "Magazine Luiza", valorMensal: "R$ 8.500", contratoFim: "15/12/2024", dimensoes: "9m x 3m" },
  { id: "2", codigo: "SP-BR-101-KM80", tipo: "Painel LED", localizacao: "Rodovia BR-101, Km 80", cidade: "Sao Paulo", uf: "SP", status: "Manutencao", cliente: "-", valorMensal: "R$ 12.000", contratoFim: "-", dimensoes: "6m x 4m" },
  { id: "3", codigo: "RJ-AV-BRASIL-500", tipo: "Front Light", localizacao: "Av. Brasil, 500", cidade: "Rio de Janeiro", uf: "RJ", status: "Disponivel", cliente: "-", valorMensal: "R$ 15.000", contratoFim: "-", dimensoes: "12m x 4m" },
  { id: "4", codigo: "MG-BR-381-KM45", tipo: "Outdoor", localizacao: "Rodovia BR-381, Km 45", cidade: "Contagem", uf: "MG", status: "Ocupada", cliente: "Coca-Cola Brasil", valorMensal: "R$ 9.200", contratoFim: "20/03/2025", dimensoes: "9m x 3m" },
  { id: "5", codigo: "PR-BR-376-KM200", tipo: "Outdoor", localizacao: "Rodovia BR-376, Km 200", cidade: "Curitiba", uf: "PR", status: "Ocupada", cliente: "Ambev S.A.", valorMensal: "R$ 7.800", contratoFim: "10/08/2024", dimensoes: "9m x 3m" },
  { id: "6", codigo: "RS-BR-116-KM50", tipo: "Painel LED", localizacao: "Rodovia BR-116, Km 50", cidade: "Porto Alegre", uf: "RS", status: "Ocupada", cliente: "Lojas Renner", valorMensal: "R$ 6.500", contratoFim: "05/11/2024", dimensoes: "6m x 3m" },
  { id: "7", codigo: "BA-BR-324-KM100", tipo: "Outdoor", localizacao: "Rodovia BR-324, Km 100", cidade: "Salvador", uf: "BA", status: "Disponivel", cliente: "-", valorMensal: "R$ 5.200", contratoFim: "-", dimensoes: "9m x 3m" },
  { id: "8", codigo: "PE-BR-101-KM60", tipo: "Front Light", localizacao: "Rodovia BR-101, Km 60", cidade: "Recife", uf: "PE", status: "Ocupada", cliente: "Lojas Americanas", valorMensal: "R$ 4.800", contratoFim: "28/09/2024", dimensoes: "12m x 4m" },
  { id: "9", codigo: "CE-BR-020-KM30", tipo: "Outdoor", localizacao: "Rodovia BR-020, Km 30", cidade: "Fortaleza", uf: "CE", status: "Manutencao", cliente: "-", valorMensal: "R$ 4.500", contratoFim: "-", dimensoes: "9m x 3m" },
  { id: "10", codigo: "GO-BR-060-KM80", tipo: "Painel LED", localizacao: "Rodovia BR-060, Km 80", cidade: "Goiania", uf: "GO", status: "Ocupada", cliente: "Natura", valorMensal: "R$ 5.500", contratoFim: "18/06/2024", dimensoes: "6m x 3m" },
]

const columns: Column<PlacaData>[] = [
  { key: "codigo", title: "Codigo", sortable: true, width: "120px" },
  { 
    key: "tipo", 
    title: "Tipo", 
    sortable: true,
    render: (value) => (
      <Badge variant="outline" className="font-normal">
        {String(value)}
      </Badge>
    )
  },
  { key: "localizacao", title: "Localizacao", sortable: true },
  { 
    key: "cidade", 
    title: "Cidade/UF", 
    sortable: true,
    render: (_, row) => `${row.cidade}, ${row.uf}`
  },
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
          : "destructive"
      return <StatusBadge status={status} variant={variant} />
    },
  },
  { key: "cliente", title: "Cliente", sortable: true },
  { key: "valorMensal", title: "Valor/Mes", sortable: true },
  { key: "contratoFim", title: "Fim Contrato", sortable: true },
]

export default function PlacasPage() {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  const stats = React.useMemo(() => ({
    total: mockPlacas.length,
    ocupadas: mockPlacas.filter((p) => p.status === "Ocupada").length,
    disponiveis: mockPlacas.filter((p) => p.status === "Disponivel").length,
    manutencao: mockPlacas.filter((p) => p.status === "Manutencao").length,
  }), [])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestao de Placas</h1>
            <p className="text-muted-foreground">
              Gerencie todas as placas e outdoors do seu inventario
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Placa
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Adicionar Nova Placa</DialogTitle>
                  <DialogDescription>
                    Preencha os dados da nova placa para adicionar ao inventario.
                  </DialogDescription>
                </DialogHeader>
                <form className="space-y-4 pt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="codigo">Codigo</Label>
                      <Input id="codigo" placeholder="BR-040-KM125" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tipo">Tipo</Label>
                      <Select>
                        <SelectTrigger id="tipo">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="outdoor">Outdoor</SelectItem>
                          <SelectItem value="painel-led">Painel LED</SelectItem>
                          <SelectItem value="front-light">Front Light</SelectItem>
                          <SelectItem value="back-light">Back Light</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="localizacao">Localizacao</Label>
                    <Input id="localizacao" placeholder="Rodovia BR-040, Km 125" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="cidade">Cidade</Label>
                      <Input id="cidade" placeholder="Belo Horizonte" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="uf">UF</Label>
                      <Select>
                        <SelectTrigger id="uf">
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MG">MG</SelectItem>
                          <SelectItem value="SP">SP</SelectItem>
                          <SelectItem value="RJ">RJ</SelectItem>
                          <SelectItem value="PR">PR</SelectItem>
                          <SelectItem value="RS">RS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dimensoes">Dimensoes</Label>
                      <Input id="dimensoes" placeholder="9m x 3m" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="valor">Valor Mensal</Label>
                      <Input id="valor" placeholder="R$ 8.500" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">Adicionar Placa</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total de Placas"
            value={stats.total}
            subtitle="em todo o inventario"
            icon={Layers}
            iconColor="primary"
          />
          <KPICard
            title="Placas Ocupadas"
            value={stats.ocupadas}
            subtitle={`${((stats.ocupadas / stats.total) * 100).toFixed(0)}% de ocupacao`}
            trend={{ value: 8.1, label: "vs. mes anterior" }}
            icon={Building2}
            iconColor="success"
          />
          <KPICard
            title="Disponiveis"
            value={stats.disponiveis}
            subtitle="prontas para locacao"
            trend={{ value: -5, label: "vs. mes anterior" }}
            icon={DollarSign}
            iconColor="warning"
          />
          <KPICard
            title="Em Manutencao"
            value={stats.manutencao}
            subtitle="retorno previsto: 7 dias"
            icon={Calendar}
            iconColor="destructive"
          />
        </div>

        {/* Data Table */}
        <DataTable
          title="Todas as Placas"
          columns={columns}
          data={mockPlacas}
          searchPlaceholder="Buscar por codigo, localizacao ou cliente..."
          onView={(row) => console.log("View", row)}
          onEdit={(row) => console.log("Edit", row)}
          onDelete={(row) => console.log("Delete", row)}
        />
      </div>
    </DashboardLayout>
  )
}
