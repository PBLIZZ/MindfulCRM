import { useState, useMemo, useEffect } from "react"
import type { ColumnDef, PaginationState, SortingState, ColumnFiltersState, VisibilityState } from "@tanstack/react-table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.js"
import { Badge } from "@/components/ui/badge.js"
import { Button } from "@/components/ui/button.js"
import { Input } from "@/components/ui/input.js"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.js"
import { Checkbox } from "@/components/ui/checkbox.js"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu.js"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.js"
import { 
  Mail, 
  Phone, 
   
  MessageSquare, 
  Eye, 
  Edit, 
  Trash2, 
  Search,
  Filter,
  Download,
  Settings,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  Camera,
  Sparkles,
  Plus
} from "lucide-react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table"

export type Contact = {
  id: string
  name: string
  email?: string
  phone?: string
  avatarUrl?: string
  lifecycleStage?: 'discovery' | 'curious' | 'new_client' | 'core_client' | 'ambassador' | 'needs_reconnecting' | 'inactive' | 'collaborator'
  tags?: Array<{id: string, name: string, color: string}>
  notes?: string
  voiceNotes?: Array<{id: string, noteUrl: string, transcription?: string}>
  lastContact?: string
  sentiment?: number
  engagementTrend?: 'improving' | 'stable' | 'declining'
  extractedFields?: Record<string, unknown>
  revenueData?: Record<string, unknown>
  referralCount?: number
  createdAt: string
  updatedAt: string
}

interface ContactsTableProps {
  contacts: Contact[]
  onSelectContact: (contactId: string) => void
  onEditContact?: (contact: Contact) => void
  onDeleteContact?: (contact: Contact) => void
  onBulkAction?: (action: string, contactIds: string[]) => void
  _onExportData?: (format: string) => void
  onAddContact?: () => void
  onAITool?: (tool: string) => void
}

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}



const getLifecycleStageColor = (stage: string) => {
  switch (stage) {
    case 'discovery':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100'
    case 'curious':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100'
    case 'new_client':
      return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
    case 'core_client':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100'
    case 'ambassador':
      return 'bg-gold-100 text-gold-800 dark:bg-gold-800 dark:text-gold-100'
    case 'needs_reconnecting':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-100'
    case 'inactive':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
    case 'collaborator':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
  }
}

const getSentimentColor = (sentiment: number) => {
  if (sentiment >= 4) return 'text-green-600'
  if (sentiment >= 3) return 'text-yellow-600'
  return 'text-red-600'
}

const getInitials = (name: string) => {
  return (
    name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() || '?'
  )
}

const DEFAULT_PREFERENCES: TablePreferences = {
  pageSize: 25,
  columnVisibility: {},
  sorting: [],
  filters: []
}

interface TablePreferences {
  pageSize: number;
  columnVisibility: Record<string, boolean>;
  sorting: SortingState;
  filters: Array<{ id: string; value: unknown }>;
}

const loadPreferences = (): TablePreferences => {
  try {
    const saved = localStorage.getItem('contacts-table-preferences')
    return saved ? { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) as Partial<TablePreferences> } : DEFAULT_PREFERENCES
  } catch {
    return DEFAULT_PREFERENCES
  }
}

const savePreferences = (preferences: Partial<TablePreferences>) => {
  try {
    localStorage.setItem('contacts-table-preferences', JSON.stringify(preferences))
  } catch {
    // Ignore errors
  }
}

export function ContactsTable({ 
  contacts, 
  onSelectContact, 
  onEditContact, 
  onDeleteContact,
  onBulkAction,
  // _onExportData,
  onAddContact,
  onAITool,
}: ContactsTableProps) {
  const [preferences] = useState(() => loadPreferences())
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>(preferences.sorting || [])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(preferences.columnVisibility || {})
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: preferences.pageSize || 25,
  })
  const [lifecycleFilter, setLifecycleFilter] = useState('all')

  const debouncedGlobalFilter = useDebounce(globalFilter, 300)

  // Save preferences when they change
  useEffect(() => {
    const newPreferences = {
      pageSize: pagination.pageSize,
      columnVisibility,
      sorting,
    }
    savePreferences(newPreferences)
  }, [pagination.pageSize, columnVisibility, sorting])

  // Get dynamic columns from extractedFields
  const dynamicColumns = useMemo(() => {
    const fieldsSet = new Set<string>()
    contacts.forEach(contact => {
      if (contact.extractedFields) {
        Object.keys(contact.extractedFields).forEach(key => fieldsSet.add(key))
      }
    })
    return Array.from(fieldsSet)
  }, [contacts])

  const columns: ColumnDef<Contact>[] = useMemo(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 hover:bg-transparent"
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const contact = row.original
        return (
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={contact.avatarUrl ?? undefined} alt={contact.name} />
              <AvatarFallback className="text-xs">
                {getInitials(contact.name)}
              </AvatarFallback>
            </Avatar>
            <div className="font-medium">{contact.name}</div>
          </div>
        )
      },
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 hover:bg-transparent"
        >
          Email
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const email = row.getValue("email") as string
        return email ? (
          <div className="flex items-center space-x-2">
            <Mail className="h-3 w-3 text-muted-foreground" />
            <span className="truncate max-w-[200px]" title={email}>{email}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0"
              onClick={async (e) => {
                e.stopPropagation()
                await navigator.clipboard.writeText(email)
              }}
            >
              📋
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => {
        const phone = row.getValue("phone") as string
        return phone ? (
          <div className="flex items-center space-x-2">
            <Phone className="h-3 w-3 text-muted-foreground" />
            <span>{phone}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
    {
      accessorKey: "lifecycleStage",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 hover:bg-transparent"
        >
          Client Journey
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const stage = row.getValue("lifecycleStage") as string
        return stage ? (
          <Badge variant="outline" className={getLifecycleStageColor(stage)}>
            {stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">Pending analysis</span>
        )
      },
    },
    {
      accessorKey: "sentiment",
      header: "Sentiment",
      cell: ({ row }) => {
        const sentiment = row.getValue("sentiment") as number
        return sentiment ? (
          <div className={`flex items-center space-x-1 ${getSentimentColor(sentiment)}`}>
            <span>{'★'.repeat(sentiment)}{'☆'.repeat(5-sentiment)}</span>
            <span className="text-xs">({sentiment}/5)</span>
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">Pending analysis</span>
        )
      },
    },
    {
      accessorKey: "engagementTrend",
      header: "Engagement",
      cell: ({ row }) => {
        const trend = row.getValue("engagementTrend") as string
        const trendColors = {
          improving: 'text-green-600',
          stable: 'text-yellow-600',
          declining: 'text-red-600'
        }
        // Only show engagement if it's been analyzed and is not the default 'stable'
        return trend && trend !== 'stable' ? (
          <span className={trendColors[trend as keyof typeof trendColors]}>
            {trend === 'improving' ? '↗️' : trend === 'declining' ? '↘️' : '→'} {trend}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">Pending analysis</span>
        )
      },
    },
    {
      accessorKey: "lastContact",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 hover:bg-transparent"
        >
          Last Contact
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const lastContact = row.getValue("lastContact") as string
        return lastContact ? (
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm">
              {new Date(lastContact).toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: 'short', 
                year: '2-digit' 
              }).replace(/\s/g, '-').toUpperCase()}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    },
    {
      accessorKey: "tags",
      header: "Tags",
      cell: ({ row }) => {
        const contact = row.original
        const tags = contact.tags ?? []
        const displayTags = tags.slice(0, 3)
        const extraCount = tags.length - 3

        return (
          <div className="flex items-center gap-1 flex-wrap">
            {displayTags.map((tag) => (
              <Badge 
                key={tag.id} 
                variant="secondary" 
                className="text-xs cursor-pointer hover:opacity-80"
                style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color }}
                onClick={(e) => {
                  e.stopPropagation()
                  // TODO: Filter by tag
                }}
              >
                {tag.name}
              </Badge>
            ))}
            {extraCount > 0 && (
              <Badge variant="outline" className="text-xs">
                +{extraCount}
              </Badge>
            )}
            {tags.length === 0 && (
              <span className="text-muted-foreground text-xs">—</span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => {
        const contact = row.original
        const notes = contact.notes
        const voiceNotes = contact.voiceNotes ?? []
        const hasContent = notes ?? voiceNotes.length > 0

        return (
          <div className="flex items-center space-x-2">
            {hasContent ? (
              <>
                {notes && (
                  <div className="flex items-center space-x-1">
                    <MessageSquare className="h-3 w-3 text-blue-600" />
                    <span className="text-xs text-muted-foreground">
                      {notes.length > 30 ? notes.substring(0, 30) + '...' : notes}
                    </span>
                  </div>
                )}
                {voiceNotes.length > 0 && (
                  <div className="flex items-center space-x-1">
                    <Badge variant="outline" className="text-xs">
                      🎤 {voiceNotes.length}
                    </Badge>
                  </div>
                )}
              </>
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            )}
          </div>
        )
      },
    },
    ...dynamicColumns.map(fieldName => ({
      id: `extracted_${fieldName}`,
      accessorFn: (row: Contact) => row.extractedFields?.[fieldName] ?? '',
      header: fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
      cell: ({ getValue }: { getValue: () => unknown }) => {
        const value = getValue() as string | number | boolean | null | undefined
        return value ? (
          <span className="text-sm text-muted-foreground">{String(value)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      },
    })),
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const contact = row.original

        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation()
                onSelectContact(contact.id)
              }}
              title="View contact details"
            >
              <Eye className="h-4 w-4 text-sky-500" />
            </Button>
            
            {onEditContact && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation()
                  onEditContact(contact)
                }}
                title="Edit contact"
              >
                <Edit className="h-4 w-4 text-green-500" />
              </Button>
            )}
            
            {onDeleteContact && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-destructive/10 text-red-600 dark:text-red-400"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteContact(contact)
                }}
                title="Delete contact"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )
      },
    },
  ], [dynamicColumns, onSelectContact, onEditContact, onDeleteContact])

  const filteredData = useMemo(() => {
    return contacts.filter(contact => {
      // Global search filter
      const searchMatch = !debouncedGlobalFilter ||
        contact.name.toLowerCase().includes(debouncedGlobalFilter.toLowerCase()) ||
        (contact.email?.toLowerCase().includes(debouncedGlobalFilter.toLowerCase()) ??
        contact.phone?.includes(debouncedGlobalFilter) ??
        Object.values(contact.extractedFields ?? {}).some(value => 
          String(value).toLowerCase().includes(debouncedGlobalFilter.toLowerCase())
        ))
      
      // Lifecycle filter
      const lifecycleMatch = lifecycleFilter === 'all' || contact.lifecycleStage === lifecycleFilter
      
      return searchMatch && lifecycleMatch
    })
  }, [contacts, debouncedGlobalFilter, lifecycleFilter])

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
      globalFilter: debouncedGlobalFilter,
    },
    enableRowSelection: true,
    getRowId: (row) => row.id,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: false,
    manualSorting: false,
    manualFiltering: false,
  })

  
  const selectedContactIds = Object.keys(rowSelection).filter(id => rowSelection[id])

  const resetPreferences = () => {
    setColumnVisibility({})
    setSorting([])
    setPagination({ pageIndex: 0, pageSize: 25 })
    localStorage.removeItem('contacts-table-preferences')
  }

  return (
    <div className="w-full space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* Global Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-8 w-[250px]"
            />
          </div>

          {/* Lifecycle Filter */}
          <Select value={lifecycleFilter} onValueChange={setLifecycleFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Client Journey" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="discovery">Discovery</SelectItem>
              <SelectItem value="curious">Curious</SelectItem>
              <SelectItem value="new_client">New Client</SelectItem>
              <SelectItem value="core_client">Core Client</SelectItem>
              <SelectItem value="ambassador">Ambassador</SelectItem>
              <SelectItem value="needs_reconnecting">Needs Reconnecting</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="collaborator">Collaborator</SelectItem>
            </SelectContent>
          </Select>

        </div>

        <div className="flex items-center space-x-2">
          {/* Bulk Actions */}
          {selectedContactIds.length > 0 && onBulkAction && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Bulk Actions ({selectedContactIds.length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onBulkAction('enrich_photos', selectedContactIds)}>
                  <Camera className="mr-2 h-4 w-4" />
                  Enrich Photos ({selectedContactIds.length})
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onBulkAction('export', selectedContactIds)}>
                  <Download className="mr-2 h-4 w-4" />
                  Export as JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onBulkAction('add_tag', selectedContactIds)}>
                  Add Tag
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onBulkAction('remove_tag', selectedContactIds)}>
                  Remove Tag
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onBulkAction('delete', selectedContactIds)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Column Visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id.replace('_', ' ')}
                    </DropdownMenuCheckboxItem>
                  )
                })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={resetPreferences}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset preferences
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* AI Tools */}
          {onAITool && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI Tools
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onAITool('enrich_photos')}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Enrich All Photos
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Add Contact */}
          {onAddContact && (
            <Button onClick={onAddContact}>
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No contacts found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">
            Rows per page
          </p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value))
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 25, 50, 100].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
      </div>
    </div>
  )
}
