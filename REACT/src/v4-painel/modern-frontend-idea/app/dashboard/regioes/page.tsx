"use client"

import * as React from "react"
import { Layers, MapPin, Building2, DollarSign, Filter, Download } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { BrazilMap, MapStatCard, type MapMarker } from "@/components/dashboard/brazil-map"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Mock data for markers
const mockMarkers: MapMarker[] = [
  { id: "1", name: "BR-040-KM125", coordinates: [-43.9378, -19.9208], status: "active", value: "R$ 8.500", client: "Magazine Luiza" },
  { id: "2", name: "SP-BR-101-KM80", coordinates: [-46.6333, -23.5505], status: "maintenance", value: "R$ 12.000" },
  { id: "3", name: "RJ-AV-BRASIL-500", coordinates: [-43.1729, -22.9068], status: "available", value: "R$ 15.000" },
  { id: "4", name: "MG-BR-381-KM45", coordinates: [-44.0369, -19.8707], status: "active", value: "R$ 9.200", client: "Coca-Cola" },
  { id: "5", name: "PR-BR-376-KM200", coordinates: [-49.2731, -25.4195], status: "active", value: "R$ 7.800", client: "Ambev" },
  { id: "6", name: "RS-BR-116-KM50", coordinates: [-51.1784, -30.0346], status: "active", value: "R$ 6.500", client: "Renner" },
  { id: "7", name: "BA-BR-324-KM100", coordinates: [-38.5014, -12.9714], status: "available", value: "R$ 5.200" },
  { id: "8", name: "PE-BR-101-KM60", coordinates: [-34.8771, -8.0476], status: "active", value: "R$ 4.800", client: "Lojas Americanas" },
  { id: "9", name: "CE-BR-020-KM30", coordinates: [-38.5423, -3.7327], status: "maintenance", value: "R$ 4.500" },
  { id: "10", name: "GO-BR-060-KM80", coordinates: [-49.2648, -16.6869], status: "active", value: "R$ 5.500", client: "Natura" },
  { id: "11", name: "SC-BR-101-KM120", coordinates: [-48.5495, -27.5954], status: "active", value: "R$ 6.200", client: "Havan" },
  { id: "12", name: "ES-BR-101-KM40", coordinates: [-40.3128, -20.3155], status: "available", value: "R$ 5.800" },
]

export default function RegioesPage() {
  const [selectedMarker, setSelectedMarker] = React.useState<MapMarker | null>(null)
  const [filter, setFilter] = React.useState<string>("all")

  const filteredMarkers = React.useMemo(() => {
    if (filter === "all") return mockMarkers
    return mockMarkers.filter((m) => m.status === filter)
  }, [filter])

  const stats = React.useMemo(() => ({
    total: mockMarkers.length,
    active: mockMarkers.filter((m) => m.status === "active").length,
    maintenance: mockMarkers.filter((m) => m.status === "maintenance").length,
    available: mockMarkers.filter((m) => m.status === "available").length,
  }), [])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mapa de Regioes</h1>
            <p className="text-muted-foreground">
              Visualize a distribuicao geografica das suas placas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MapStatCard
            label="Total de Placas"
            value={stats.total}
            icon={<Layers className="h-4 w-4" />}
            trend={5.2}
          />
          <MapStatCard
            label="Placas Ocupadas"
            value={stats.active}
            icon={<Building2 className="h-4 w-4" />}
            trend={8.1}
          />
          <MapStatCard
            label="Em Manutencao"
            value={stats.maintenance}
            icon={<MapPin className="h-4 w-4" />}
            trend={-12}
          />
          <MapStatCard
            label="Disponiveis"
            value={stats.available}
            icon={<DollarSign className="h-4 w-4" />}
            trend={3.5}
          />
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Map */}
          <div className="lg:col-span-2">
            <BrazilMap
              markers={filteredMarkers}
              onMarkerClick={setSelectedMarker}
              selectedMarkerId={selectedMarker?.id}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Filters */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Filtros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Ocupadas</SelectItem>
                      <SelectItem value="maintenance">Manutencao</SelectItem>
                      <SelectItem value="available">Disponiveis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Buscar</label>
                  <Input placeholder="Codigo da placa..." className="h-9" />
                </div>
              </CardContent>
            </Card>

            {/* Selected Marker Details */}
            {selectedMarker ? (
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{selectedMarker.name}</CardTitle>
                    <Badge
                      variant="outline"
                      className={
                        selectedMarker.status === "active"
                          ? "border-success/20 bg-success/10 text-success"
                          : selectedMarker.status === "maintenance"
                          ? "border-warning/20 bg-warning/10 text-warning"
                          : "border-primary/20 bg-primary/10 text-primary"
                      }
                    >
                      {selectedMarker.status === "active"
                        ? "Ocupada"
                        : selectedMarker.status === "maintenance"
                        ? "Manutencao"
                        : "Disponivel"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Valor mensal</span>
                    <span className="font-medium">{selectedMarker.value}</span>
                  </div>
                  {selectedMarker.client && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Cliente</span>
                      <span className="font-medium">{selectedMarker.client}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Coordenadas</span>
                    <span className="font-mono text-xs">
                      {selectedMarker.coordinates[1].toFixed(4)}, {selectedMarker.coordinates[0].toFixed(4)}
                    </span>
                  </div>
                  <div className="pt-2">
                    <Button className="w-full" size="sm">
                      Ver Detalhes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <MapPin className="h-10 w-10 text-muted-foreground/30" />
                  <p className="mt-2 text-sm font-medium text-muted-foreground">
                    Selecione uma placa
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Clique em um marcador no mapa
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Quick List */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Placas Disponiveis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {mockMarkers
                  .filter((m) => m.status === "available")
                  .slice(0, 4)
                  .map((marker) => (
                    <button
                      key={marker.id}
                      className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent/50"
                      onClick={() => setSelectedMarker(marker)}
                    >
                      <div>
                        <p className="text-sm font-medium">{marker.name}</p>
                        <p className="text-xs text-muted-foreground">{marker.value}/mes</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        Disponivel
                      </Badge>
                    </button>
                  ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
