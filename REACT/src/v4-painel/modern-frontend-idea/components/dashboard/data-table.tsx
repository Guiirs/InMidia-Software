"use client"

import * as React from "react"
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  MoreHorizontal,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface Column<T> {
  key: keyof T | string
  title: string
  sortable?: boolean
  width?: string
  render?: (value: unknown, row: T) => React.ReactNode
}

interface DataTableProps<T extends Record<string, unknown>> {
  title?: string
  columns: Column<T>[]
  data: T[]
  searchable?: boolean
  searchPlaceholder?: string
  onRowClick?: (row: T) => void
  actions?: boolean
  onView?: (row: T) => void
  onEdit?: (row: T) => void
  onDelete?: (row: T) => void
}

export function DataTable<T extends Record<string, unknown>>({
  title,
  columns,
  data,
  searchable = true,
  searchPlaceholder = "Buscar...",
  onRowClick,
  actions = true,
  onView,
  onEdit,
  onDelete,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [sortKey, setSortKey] = React.useState<string | null>(null)
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc")

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDirection("asc")
    }
  }

  const filteredData = React.useMemo(() => {
    let result = [...data]

    // Filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter((row) =>
        Object.values(row).some(
          (value) =>
            value !== null &&
            value !== undefined &&
            String(value).toLowerCase().includes(query)
        )
      )
    }

    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        const aValue = a[sortKey as keyof T]
        const bValue = b[sortKey as keyof T]

        if (aValue === bValue) return 0
        if (aValue === null || aValue === undefined) return 1
        if (bValue === null || bValue === undefined) return -1

        const comparison = String(aValue).localeCompare(String(bValue), undefined, {
          numeric: true,
        })

        return sortDirection === "asc" ? comparison : -comparison
      })
    }

    return result
  }, [data, searchQuery, sortKey, sortDirection])

  return (
    <Card>
      {(title || searchable) && (
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {title && <CardTitle className="text-base">{title}</CardTitle>}
            <div className="flex items-center gap-2">
              {searchable && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 w-[200px] pl-8 text-sm"
                  />
                </div>
              )}
              <Button variant="outline" size="sm" className="h-8 gap-1">
                <Filter className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Filtros</span>
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-y border-border bg-muted/50">
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={cn(
                      "h-10 px-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground",
                      column.sortable && "cursor-pointer select-none hover:text-foreground"
                    )}
                    style={{ width: column.width }}
                    onClick={() => column.sortable && handleSort(String(column.key))}
                  >
                    <div className="flex items-center gap-1">
                      {column.title}
                      {column.sortable && (
                        <span className="text-muted-foreground/50">
                          {sortKey === column.key ? (
                            sortDirection === "asc" ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                {actions && (
                  <th className="h-10 w-12 px-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Acoes
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (actions ? 1 : 0)}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    Nenhum resultado encontrado
                  </td>
                </tr>
              ) : (
                filteredData.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={cn(
                      "group transition-colors hover:bg-muted/50",
                      onRowClick && "cursor-pointer"
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((column) => {
                      const value = row[column.key as keyof T]
                      return (
                        <td
                          key={String(column.key)}
                          className="px-4 py-3 text-sm"
                        >
                          {column.render
                            ? column.render(value, row)
                            : String(value ?? "-")}
                        </td>
                      )
                    })}
                    {actions && (
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView?.(row)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit?.(row)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onDelete?.(row)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Mostrando {filteredData.length} de {data.length} registros
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled>
              <ChevronDown className="h-4 w-4 rotate-90" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
              1
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              2
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              3
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0">
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Status badge helper
export function StatusBadge({
  status,
  variant = "default",
}: {
  status: string
  variant?: "default" | "success" | "warning" | "destructive" | "outline"
}) {
  const variantStyles = {
    default: "bg-primary/10 text-primary border-primary/20",
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    outline: "bg-transparent border-border text-muted-foreground",
  }

  return (
    <Badge variant="outline" className={cn("font-medium", variantStyles[variant])}>
      {status}
    </Badge>
  )
}
