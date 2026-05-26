"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  MapPin,
  FileText,
  BarChart3,
  Bell,
  Settings,
  Users,
  Building2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  HelpCircle,
  Layers,
  Target,
  TrendingUp,
  Calendar,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  badge?: number
}

const mainNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Placas", href: "/dashboard/placas", icon: Layers },
  { title: "Contratos", href: "/dashboard/contratos", icon: FileText },
  { title: "Campanhas", href: "/dashboard/campanhas", icon: Target },
  { title: "Regioes", href: "/dashboard/regioes", icon: MapPin },
  { title: "Relatorios", href: "/dashboard/relatorios", icon: BarChart3 },
]

const secondaryNavItems: NavItem[] = [
  { title: "Alertas", href: "/dashboard/alertas", icon: Bell, badge: 5 },
  { title: "Clientes", href: "/dashboard/clientes", icon: Users },
  { title: "Empresa", href: "/dashboard/empresa", icon: Building2 },
]

const bottomNavItems: NavItem[] = [
  { title: "Configuracoes", href: "/dashboard/configuracoes", icon: Settings },
  { title: "Ajuda", href: "/dashboard/ajuda", icon: HelpCircle },
]

interface AppSidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

export function AppSidebar({ collapsed = false, onToggle }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center h-16 px-4 border-b border-sidebar-border",
          collapsed ? "justify-center" : "justify-between"
        )}>
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <TrendingUp className="h-4 w-4" />
              </div>
              <span className="font-semibold text-lg text-sidebar-foreground">InMidia</span>
            </Link>
          )}
          {collapsed && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <TrendingUp className="h-4 w-4" />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className={cn(
              "h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent",
              collapsed && "absolute -right-3 top-6 z-10 rounded-full border border-sidebar-border bg-sidebar shadow-sm"
            )}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">
          <div className="space-y-1 px-2">
            {mainNavItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
            ))}
          </div>

          <div className="mt-6 px-4">
            {!collapsed && (
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Gestao
              </span>
            )}
            {collapsed && <div className="h-px bg-sidebar-border" />}
          </div>

          <div className="mt-2 space-y-1 px-2">
            {secondaryNavItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-2">
          <div className="space-y-1">
            {bottomNavItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
            ))}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>Sair</span>}
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="font-medium">
                  Sair
                </TooltipContent>
              )}
            </Tooltip>
          </div>

          {/* User Profile */}
          {!collapsed && (
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-sidebar-accent p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                JD
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">Joao Silva</p>
                <p className="text-xs text-muted-foreground truncate">Administrador</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}

function NavLink({ item, pathname, collapsed }: { item: NavItem; pathname: string; collapsed: boolean }) {
  const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
  const Icon = item.icon

  const linkContent = (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1">{item.title}</span>
          {item.badge && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground">
              {item.badge}
            </span>
          )}
        </>
      )}
      {collapsed && item.badge && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
          {item.badge}
        </span>
      )}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">{linkContent}</div>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.title}
          {item.badge && ` (${item.badge})`}
        </TooltipContent>
      </Tooltip>
    )
  }

  return linkContent
}
