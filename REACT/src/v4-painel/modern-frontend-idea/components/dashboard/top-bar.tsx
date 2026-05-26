"use client"

import * as React from "react"
import { Search, Command, Bell, Moon, Sun, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface TopBarProps {
  onSearchOpen?: () => void
}

export function TopBar({ onSearchOpen }: TopBarProps) {
  const [isDark, setIsDark] = React.useState(true)

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle("dark")
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Search */}
      <div className="flex flex-1 items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar placas, contratos, clientes..."
            className="h-9 w-full bg-secondary/50 pl-9 pr-12 text-sm focus-visible:bg-background"
            onClick={onSearchOpen}
            readOnly
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            <Command className="h-3 w-3" />K
          </kbd>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Quick Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Criar novo</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Nova Placa</DropdownMenuItem>
            <DropdownMenuItem>Novo Contrato</DropdownMenuItem>
            <DropdownMenuItem>Nova Campanha</DropdownMenuItem>
            <DropdownMenuItem>Novo Cliente</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                3
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notificacoes
              <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary hover:text-primary/80">
                Marcar como lidas
              </Button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-[300px] overflow-y-auto">
              <NotificationItem
                title="Contrato vencendo"
                description="Contrato #1234 vence em 5 dias"
                time="5 min"
                type="warning"
              />
              <NotificationItem
                title="Placa sem campanha"
                description="Placa BR-040-KM125 esta sem campanha ativa"
                time="1 hora"
                type="error"
              />
              <NotificationItem
                title="Novo cliente cadastrado"
                description="Magazine Luiza foi adicionado"
                time="3 horas"
                type="success"
              />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-primary">
              Ver todas notificacoes
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  )
}

interface NotificationItemProps {
  title: string
  description: string
  time: string
  type: "success" | "warning" | "error" | "info"
}

function NotificationItem({ title, description, time, type }: NotificationItemProps) {
  const typeStyles = {
    success: "bg-success/10 border-success/20",
    warning: "bg-warning/10 border-warning/20",
    error: "bg-destructive/10 border-destructive/20",
    info: "bg-primary/10 border-primary/20",
  }

  const dotStyles = {
    success: "bg-success",
    warning: "bg-warning",
    error: "bg-destructive",
    info: "bg-primary",
  }

  return (
    <div className={cn("flex gap-3 border-l-2 p-3", typeStyles[type])}>
      <div className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", dotStyles[type])} />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium leading-none">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground">{time} atras</p>
      </div>
    </div>
  )
}
