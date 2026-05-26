"use client"

import * as React from "react"
import { AlertTriangle, AlertCircle, Info, CheckCircle, Clock, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export type AlertSeverity = "critical" | "warning" | "info" | "success"

export interface Alert {
  id: string
  title: string
  description: string
  severity: AlertSeverity
  timestamp: string
  category: string
  actionLabel?: string
  actionHref?: string
}

interface AlertPanelProps {
  alerts: Alert[]
  maxItems?: number
  onViewAll?: () => void
  onDismiss?: (id: string) => void
}

export function AlertPanel({ alerts, maxItems = 5, onViewAll, onDismiss }: AlertPanelProps) {
  const displayedAlerts = alerts.slice(0, maxItems)
  const hasMore = alerts.length > maxItems

  const criticalCount = alerts.filter(a => a.severity === "critical").length
  const warningCount = alerts.filter(a => a.severity === "warning").length

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Alertas e Pendencias
          </CardTitle>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} criticos
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge className="bg-warning/10 text-warning hover:bg-warning/20 text-xs">
                {warningCount} atencao
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {displayedAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-10 w-10 text-success/50" />
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              Nenhum alerta no momento
            </p>
            <p className="text-xs text-muted-foreground">
              Tudo funcionando normalmente
            </p>
          </div>
        ) : (
          <>
            {displayedAlerts.map((alert) => (
              <AlertItem key={alert.id} alert={alert} onDismiss={onDismiss} />
            ))}
            {hasMore && (
              <Button
                variant="ghost"
                className="w-full text-sm text-primary"
                onClick={onViewAll}
              >
                Ver todos os {alerts.length} alertas
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

interface AlertItemProps {
  alert: Alert
  onDismiss?: (id: string) => void
}

function AlertItem({ alert, onDismiss }: AlertItemProps) {
  const severityConfig = {
    critical: {
      icon: AlertCircle,
      bg: "bg-destructive/5 border-destructive/20",
      iconColor: "text-destructive",
      badge: "bg-destructive/10 text-destructive",
    },
    warning: {
      icon: AlertTriangle,
      bg: "bg-warning/5 border-warning/20",
      iconColor: "text-warning",
      badge: "bg-warning/10 text-warning",
    },
    info: {
      icon: Info,
      bg: "bg-primary/5 border-primary/20",
      iconColor: "text-primary",
      badge: "bg-primary/10 text-primary",
    },
    success: {
      icon: CheckCircle,
      bg: "bg-success/5 border-success/20",
      iconColor: "text-success",
      badge: "bg-success/10 text-success",
    },
  }

  const config = severityConfig[alert.severity]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50",
        config.bg
      )}
    >
      <div className={cn("mt-0.5 shrink-0", config.iconColor)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{alert.title}</p>
          <Badge variant="outline" className={cn("shrink-0 text-[10px]", config.badge)}>
            {alert.category}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{alert.description}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {alert.timestamp}
          </span>
          {alert.actionLabel && (
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
              <a href={alert.actionHref || "#"}>
                {alert.actionLabel}
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
