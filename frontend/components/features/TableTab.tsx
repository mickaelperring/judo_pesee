"use client"

import { useState, useEffect, useCallback } from "react"
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragOverlay,
  DragStartEvent, 
  DragEndEvent,
  DragOverEvent
} from "@dnd-kit/core"
import { 
  SortableContext, 
  sortableKeyboardCoordinates, 
  rectSortingStrategy,
  useSortable,
  arrayMove
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { getParticipants, getPoolAssignments, updatePoolAssignments, getConfig } from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Wand2, ExternalLink, GripVertical } from "lucide-react"
import Link from "next/link"

// --- Components ---

interface PoolCardData {
    uniqueId: string // "cat-pool"
    category: string
    poolNumber: number
    participantCount: number
    label: string
    participants: string[]
}

function PoolCard({ id, data, isOverlay = false }: { id: string, data: PoolCardData, isOverlay?: boolean }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    }

    const content = (
        <div className={cn(
            "bg-card border rounded-md p-2 shadow-sm select-none flex flex-col gap-1 w-44",
            isOverlay ? "cursor-grabbing shadow-xl border-primary" : "hover:border-primary/50"
        )}>
            <div className="flex justify-between items-center border-b pb-1 mb-1">
                <div {...attributes} {...listeners} className="touch-none p-1 -m-1 cursor-grab active:cursor-grabbing">
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                </div>
                <span className="font-bold text-[10px] truncate flex-1 ml-2" title={data.label}>{data.label}</span>
                <span className="text-[10px] bg-secondary px-1.5 rounded-full">{data.participantCount}</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5 max-h-20 overflow-hidden">
                {data.participants.slice(0, 4).map((name, idx) => (
                    <div key={idx} className="truncate">• {name}</div>
                ))}
                {data.participants.length > 4 && <div className="text-[9px] italic">...</div>}
            </div>
        </div>
    )

    if (isOverlay) return content

    return (
        <div ref={setNodeRef} style={style}>
            {content}
        </div>
    )
}

function TableRow({ id, title, items, isUnassigned = false }: { id: string, title: string, items: PoolCardData[], isUnassigned?: boolean }) {
    const { setNodeRef } = useSortable({ id, disabled: true }) 
    const tableId = id.replace("table-", "")
    
    return (
        <div className={cn(
            "flex flex-col md:flex-row items-start md:items-center gap-4 p-4 border rounded-lg transition-colors",
            isUnassigned ? "bg-muted/20 border-dashed border-2 min-h-[120px]" : "bg-card shadow-sm min-h-[100px]"
        )}>
            <div className="w-32 shrink-0 flex flex-col gap-2">
                <div className={cn(
                    "font-bold text-sm uppercase tracking-wider flex items-center gap-2",
                    isUnassigned ? "text-muted-foreground" : "text-primary"
                )}>
                    {title}
                    <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs">
                        {items.length}
                    </span>
                </div>
                {!isUnassigned && (
                    <Button variant="outline" size="sm" className="w-full text-xs h-7" asChild>
                        <Link href={`/table/${tableId}`}>
                            <ExternalLink className="mr-2 h-3 w-3" /> Ouvrir
                        </Link>
                    </Button>
                )}
            </div>
            
            <div ref={setNodeRef} className="flex-1 flex flex-wrap gap-2 w-full">
                <SortableContext items={items.map(i => i.uniqueId)} strategy={rectSortingStrategy}>
                    {items.length === 0 && (
                        <div className="text-sm text-muted-foreground/30 italic w-full text-center py-2">
                            {isUnassigned ? "Aucune poule en attente" : "Déposez des poules ici"}
                        </div>
                    )}
                    {items.map(item => (
                        <PoolCard key={item.uniqueId} id={item.uniqueId} data={item} />
                    ))}
                </SortableContext>
            </div>
        </div>
    )
}

export default function TableTab() {
    const [tableCount, setTableCount] = useState(5)
    const [columns, setColumns] = useState<Record<string, PoolCardData[]>>({})
    const [activeId, setActiveId] = useState<string | null>(null)
    const [activeData, setActiveData] = useState<PoolCardData | null>(null)
    const [startContainerId, setStartContainerId] = useState<string | null>(null)
    
    // Category Management
    const [activeCategories, setActiveCategories] = useState<string[]>([])
    const [isConfigLoaded, setIsConfigLoaded] = useState(false)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    // Initial Load
    useEffect(() => {
        Promise.all([
            getConfig("active_categories"),
            getConfig("table_count")
        ]).then(([confActive, confTable]) => {
            if (confActive.value) setActiveCategories(confActive.value.split(","))
            if (confTable.value) setTableCount(parseInt(confTable.value))
            setIsConfigLoaded(true)
        })
    }, [])

    const loadBoard = useCallback(async () => {
        if (!isConfigLoaded) return

        try {
            // Use local state activeCategories instead of fetching config again
            const activeCats = activeCategories

            if (activeCats.length === 0) {
                 setColumns({})
                 return
            }

            const allParticipants = await getParticipants() 
            const poolsMap: Record<string, PoolCardData> = {}
            
            allParticipants.forEach(p => {
                if (!p.pool_number) return
                if (!activeCats.includes(p.category)) return

                const key = `${p.category}::${p.pool_number}`
                if (!poolsMap[key]) {
                    poolsMap[key] = {
                        uniqueId: key,
                        category: p.category,
                        poolNumber: p.pool_number,
                        participantCount: 0,
                        label: `${p.category} - P${p.pool_number}`,
                        participants: []
                    }
                }
                poolsMap[key].participantCount++
                poolsMap[key].participants.push(`${p.firstname} ${p.lastname}`)
            })

            const allAssignments = await getPoolAssignments()
            const assignments = allAssignments.filter(a => activeCats.includes(a.category))
            
            const cols: Record<string, PoolCardData[]> = {}
            
            for (let i = 1; i <= tableCount; i++) {
                cols[`table-${i}`] = []
            }
            cols["unassigned"] = []

            const assignedKeys = new Set<string>()
            assignments.sort((a, b) => a.order - b.order)

            assignments.forEach(a => {
                const key = `${a.category}::${a.pool_number}`
                const card = poolsMap[key]
                if (card) {
                    const colId = `table-${a.table_number}`
                    if (cols[colId]) {
                        cols[colId].push(card)
                        assignedKeys.add(key)
                    }
                }
            })

            Object.values(poolsMap).forEach(card => {
                if (!assignedKeys.has(card.uniqueId)) {
                    cols["unassigned"].push(card)
                }
            })

            setColumns(cols)
        } catch {
            toast.error("Erreur de chargement du tableau")
        }
    }, [activeCategories, tableCount, isConfigLoaded])

    useEffect(() => {
        // eslint-disable-next-line
        loadBoard()
    }, [loadBoard])

    const findContainer = (id: string) => {
        if (id in columns) return id
        return Object.keys(columns).find(key => columns[key].find(item => item.uniqueId === id))
    }

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event
        setActiveId(active.id as string)
        const startContainer = findContainer(active.id as string)
        if (startContainer) setStartContainerId(startContainer)

        for (const col of Object.values(columns)) {
            const found = col.find(i => i.uniqueId === active.id)
            if (found) setActiveData(found)
        }
    }

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event
        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string

        const activeContainer = findContainer(activeId)
        const overContainer = findContainer(overId)

        if (!activeContainer || !overContainer || activeContainer === overContainer) {
            return
        }

        setColumns((prev) => {
            const activeItems = prev[activeContainer]
            const overItems = prev[overContainer]
            const activeIndex = activeItems.findIndex((i) => i.uniqueId === activeId)
            const overIndex = overItems.findIndex((i) => i.uniqueId === overId)

            let newIndex
            if (overId in prev) {
                newIndex = overItems.length + 1
            } else {
                const isBelowOverItem =
                    over &&
                    active.rect.current.translated &&
                    active.rect.current.translated.top > over.rect.top + over.rect.height;

                const modifier = isBelowOverItem ? 1 : 0;
                newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
            }

            return {
                ...prev,
                [activeContainer]: [
                    ...prev[activeContainer].filter((item) => item.uniqueId !== activeId)
                ],
                [overContainer]: [
                    ...prev[overContainer].slice(0, newIndex),
                    activeItems[activeIndex],
                    ...prev[overContainer].slice(newIndex, prev[overContainer].length)
                ]
            };
        });
    }

    const saveAll = async (currentCols: Record<string, PoolCardData[]>) => {
         const updates: { category: string, pool_number: number, table_number: number, order: number }[] = []
         
         Object.entries(currentCols).forEach(([colId, items]) => {
             const tableNum = colId === "unassigned" ? 0 : parseInt(colId.replace("table-", ""))
             
             items.forEach((item, idx) => {
                 updates.push({
                     category: item.category,
                     pool_number: item.poolNumber,
                     table_number: tableNum,
                     order: idx
                 })
             })
         })
         
         try {
             await updatePoolAssignments(updates)
         } catch {
             toast.error("Erreur de sauvegarde")
         }
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        const activeId = active.id as string
        const overId = over ? over.id as string : null

        const activeContainer = findContainer(activeId)
        const overContainer = overId ? findContainer(overId) : null

        if (
            activeContainer &&
            overContainer &&
            (activeContainer === overContainer || overContainer)
        ) {
            const activeIndex = columns[activeContainer].findIndex((i) => i.uniqueId === activeId)
            const overIndex = columns[overContainer].findIndex((i) => i.uniqueId === overId)

            const newColumns = { ...columns }
            const containerChanged = startContainerId !== activeContainer

            if (activeContainer === overContainer) {
                if (activeIndex !== overIndex) {
                     newColumns[activeContainer] = arrayMove(newColumns[activeContainer], activeIndex, overIndex)
                     setColumns(newColumns)
                     saveAll(newColumns)
                } else if (containerChanged) {
                    saveAll(newColumns)
                }
            } else {
                saveAll(columns)
            }
        }
        
        setActiveId(null)
        setActiveData(null)
        setStartContainerId(null)
    }

    const handleAutoDistribute = () => {
        if (!confirm("Cela va redistribuer toutes les poules sur les tables. Continuer ?")) return

        // Gather all items
        const allItems: PoolCardData[] = []
        Object.values(columns).forEach(items => allItems.push(...items))
        
        // Sort by category then pool number
        allItems.sort((a, b) => {
            if (a.category !== b.category) return a.category.localeCompare(b.category)
            return a.poolNumber - b.poolNumber
        })

        // Distribute
        const newColumns: Record<string, PoolCardData[]> = {}
        for (let i = 1; i <= tableCount; i++) {
            newColumns[`table-${i}`] = []
        }
        newColumns["unassigned"] = []

        allItems.forEach((item, index) => {
            const tableIndex = (index % tableCount) + 1
            newColumns[`table-${tableIndex}`].push(item)
        })

        setColumns(newColumns)
        saveAll(newColumns)
        toast.success("Répartition automatique effectuée")
    }

    return (
        <div className="h-full flex flex-col space-y-4 pb-20">
            {/* Header / Actions */}
            <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
                <div className="flex flex-col gap-1">
                    <h2 className="font-bold text-lg">Gestion des Tables</h2>
                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-sm text-muted-foreground">Catégories actives :</span>
                        {activeCategories.length > 0 ? (
                            activeCategories.map(cat => (
                                <Badge key={cat} variant="secondary" className="font-normal">
                                    {cat}
                                </Badge>
                            ))
                        ) : (
                            <span className="text-sm italic text-muted-foreground">Aucune (Configurer dans Admin)</span>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => loadBoard()} variant="outline">Actualiser</Button>
                    <Button onClick={handleAutoDistribute} variant="outline">
                        <Wand2 className="mr-2 h-4 w-4" /> Répartition Auto
                    </Button>
                </div>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div className="space-y-4">
                     {/* Unassigned Area */}
                     <TableRow id="unassigned" title="À placer" items={columns["unassigned"] || []} isUnassigned />
                     
                     {/* Tables */}
                     <div className="space-y-2">
                        {Array.from({ length: tableCount }).map((_, i) => (
                            <TableRow 
                                key={`table-${i+1}`} 
                                id={`table-${i+1}`} 
                                title={`Table ${i+1}`} 
                                items={columns[`table-${i+1}`] || []} 
                            />
                        ))}
                     </div>
                </div>

                <DragOverlay>
                    {activeId && activeData ? (
                        <PoolCard id={activeId} data={activeData} isOverlay />
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    )
}
