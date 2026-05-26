"use client"

import * as React from "react"
import { 
  ComposableMap, 
  Geographies, 
  Geography, 
  Marker,
  ZoomableGroup 
} from "react-simple-maps"
import { MapPin, ZoomIn, ZoomOut, Maximize2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Brazil TopoJSON URL
const BRAZIL_TOPO_JSON = "https://cdn.jsdelivr.net/npm/brazilian-geodata@0.1.0/topojson/brazil_states.json"

export interface MapMarker {
  id: string
  name: string
  coordinates: [number, number] // [longitude, latitude]
  status: "active" | "maintenance" | "available"
  value?: string
  client?: string
}

interface BrazilMapProps {
  markers?: MapMarker[]
  onMarkerClick?: (marker: MapMarker) => void
  selectedMarkerId?: string
  className?: string
}

export function BrazilMap({
  markers = [],
  onMarkerClick,
  selectedMarkerId,
  className,
}: BrazilMapProps) {
  const [position, setPosition] = React.useState({ coordinates: [-55, -15], zoom: 1 })
  const [hoveredMarker, setHoveredMarker] = React.useState<string | null>(null)

  const handleZoomIn = () => {
    if (position.zoom >= 4) return
    setPosition(pos => ({ ...pos, zoom: pos.zoom * 1.5 }))
  }

  const handleZoomOut = () => {
    if (position.zoom <= 0.5) return
    setPosition(pos => ({ ...pos, zoom: pos.zoom / 1.5 }))
  }

  const handleReset = () => {
    setPosition({ coordinates: [-55, -15], zoom: 1 })
  }

  const getMarkerColor = (status: MapMarker["status"]) => {
    switch (status) {
      case "active":
        return "fill-success"
      case "maintenance":
        return "fill-warning"
      case "available":
        return "fill-primary"
      default:
        return "fill-muted-foreground"
    }
  }

  const getMarkerStroke = (status: MapMarker["status"]) => {
    switch (status) {
      case "active":
        return "stroke-success/50"
      case "maintenance":
        return "stroke-warning/50"
      case "available":
        return "stroke-primary/50"
      default:
        return "stroke-muted-foreground/50"
    }
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-primary" />
            Mapa de Distribuicao
          </CardTitle>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Aumentar zoom</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Diminuir zoom</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleReset}>
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Resetar visualizacao</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 pt-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-success" />
            <span className="text-xs text-muted-foreground">Ocupada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-warning" />
            <span className="text-xs text-muted-foreground">Manutencao</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Disponivel</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative aspect-[4/3] w-full bg-muted/20">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{
              scale: 600,
              center: [-55, -15],
            }}
            className="h-full w-full"
          >
            <ZoomableGroup
              zoom={position.zoom}
              center={position.coordinates as [number, number]}
              onMoveEnd={({ coordinates, zoom }) => setPosition({ coordinates, zoom })}
            >
              <Geographies geography={BRAZIL_TOPO_JSON}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      className="fill-secondary stroke-border transition-colors hover:fill-accent"
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none" },
                        pressed: { outline: "none" },
                      }}
                    />
                  ))
                }
              </Geographies>

              {/* Markers */}
              {markers.map((marker) => (
                <Marker
                  key={marker.id}
                  coordinates={marker.coordinates}
                  onClick={() => onMarkerClick?.(marker)}
                  onMouseEnter={() => setHoveredMarker(marker.id)}
                  onMouseLeave={() => setHoveredMarker(null)}
                >
                  <circle
                    r={selectedMarkerId === marker.id ? 8 : 6}
                    className={cn(
                      "cursor-pointer transition-all",
                      getMarkerColor(marker.status),
                      getMarkerStroke(marker.status),
                      "stroke-2",
                      selectedMarkerId === marker.id && "animate-pulse"
                    )}
                  />
                  {hoveredMarker === marker.id && (
                    <circle
                      r={12}
                      className={cn(
                        "animate-ping opacity-30",
                        getMarkerColor(marker.status)
                      )}
                    />
                  )}
                </Marker>
              ))}
            </ZoomableGroup>
          </ComposableMap>

          {/* Marker Count Badge */}
          <div className="absolute bottom-4 left-4">
            <Badge variant="secondary" className="gap-1.5 bg-background/80 backdrop-blur-sm">
              <MapPin className="h-3 w-3" />
              {markers.length} placas
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Mini stats card for map sidebar
interface MapStatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  trend?: number
}

export function MapStatCard({ label, value, icon, trend }: MapStatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      {icon && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <p className="text-lg font-semibold">{value}</p>
          {trend !== undefined && (
            <span
              className={cn(
                "text-xs font-medium",
                trend >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {trend >= 0 ? "+" : ""}{trend}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
