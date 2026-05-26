"use client"

import * as React from "react"
import { TrendingUp, TrendingDown, Minus, LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: number
    label: string
  }
  icon?: LucideIcon
  iconColor?: "primary" | "success" | "warning" | "destructive"
  sparklineData?: number[]
}

export function KPICard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  iconColor = "primary",
  sparklineData,
}: KPICardProps) {
  const iconColors = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  }

  const trendIcon = trend
    ? trend.value > 0
      ? TrendingUp
      : trend.value < 0
      ? TrendingDown
      : Minus
    : null

  const trendColor = trend
    ? trend.value > 0
      ? "text-success"
      : trend.value < 0
      ? "text-destructive"
      : "text-muted-foreground"
    : ""

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold tracking-tight">{value}</p>
              {trend && trendIcon && (
                <span className={cn("flex items-center gap-0.5 text-xs font-medium", trendColor)}>
                  {React.createElement(trendIcon, { className: "h-3 w-3" })}
                  {Math.abs(trend.value)}%
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <p className="text-xs text-muted-foreground">{trend.label}</p>
            )}
          </div>
          {Icon && (
            <div className={cn("rounded-lg p-2.5", iconColors[iconColor])}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>

        {/* Sparkline */}
        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-4 flex h-8 items-end gap-0.5">
            {sparklineData.map((value, index) => {
              const max = Math.max(...sparklineData)
              const height = (value / max) * 100
              return (
                <div
                  key={index}
                  className="flex-1 rounded-t bg-primary/20 transition-all hover:bg-primary/40"
                  style={{ height: `${height}%` }}
                />
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface StatusIndicatorProps {
  status: "healthy" | "warning" | "critical" | "inactive"
  label?: string
  pulse?: boolean
}

export function StatusIndicator({ status, label, pulse = false }: StatusIndicatorProps) {
  const statusStyles = {
    healthy: "bg-success",
    warning: "bg-warning",
    critical: "bg-destructive",
    inactive: "bg-muted-foreground",
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "relative flex h-2.5 w-2.5 rounded-full",
          statusStyles[status]
        )}
      >
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              statusStyles[status]
            )}
          />
        )}
      </span>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  )
}

interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showPercentage?: boolean
  size?: "sm" | "md" | "lg"
  color?: "primary" | "success" | "warning" | "destructive"
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showPercentage = true,
  size = "md",
  color = "primary",
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100)

  const sizeStyles = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  }

  const colorStyles = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  }

  return (
    <div className="space-y-1.5">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="text-muted-foreground">{label}</span>}
          {showPercentage && (
            <span className="font-medium">{percentage.toFixed(0)}%</span>
          )}
        </div>
      )}
      <div className={cn("w-full overflow-hidden rounded-full bg-secondary", sizeStyles[size])}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", colorStyles[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
