"use client"

import * as React from "react"
import { FileText, Target, Building2, Calendar, MoreVertical, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface ActivityItem {
  id: string
  type: "contract" | "campaign" | "client" | "system"
  title: string
  description: string
  timestamp: string
  user?: string
  metadata?: Record<string, string>
}

interface ActivityFeedProps {
  activities: ActivityItem[]
  maxItems?: number
  onViewAll?: () => void
}

export function ActivityFeed({ activities, maxItems = 6, onViewAll }: ActivityFeedProps) {
  const displayedActivities = activities.slice(0, maxItems)

  const typeConfig = {
    contract: { icon: FileText, color: "text-primary", bg: "bg-primary/10" },
    campaign: { icon: Target, color: "text-success", bg: "bg-success/10" },
    client: { icon: Building2, color: "text-warning", bg: "bg-warning/10" },
    system: { icon: Calendar, color: "text-muted-foreground", bg: "bg-muted" },
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Atividade Recente</CardTitle>
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            Ver tudo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-4">
            {displayedActivities.map((activity, index) => {
              const config = typeConfig[activity.type]
              const Icon = config.icon

              return (
                <div
                  key={activity.id}
                  className="relative flex gap-3 animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      config.bg
                    )}
                  >
                    <Icon className={cn("h-3 w-3", config.color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-1 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium leading-tight">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">{activity.description}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            Ver detalhes
                            <ArrowUpRight className="ml-auto h-3 w-3" />
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{activity.timestamp}</span>
                      {activity.user && (
                        <>
                          <span>•</span>
                          <span>{activity.user}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface QuickStatsProps {
  stats: {
    label: string
    value: string | number
    change?: number
  }[]
}

export function QuickStats({ stats }: QuickStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="rounded-lg border border-border bg-card p-3 animate-slide-up"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <p className="text-xs text-muted-foreground">{stat.label}</p>
          <div className="mt-1 flex items-baseline gap-1">
            <p className="text-xl font-semibold">{stat.value}</p>
            {stat.change !== undefined && (
              <span
                className={cn(
                  "text-xs font-medium",
                  stat.change >= 0 ? "text-success" : "text-destructive"
                )}
              >
                {stat.change >= 0 ? "+" : ""}
                {stat.change}%
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
