"use client"

import { useState, useEffect, useCallback } from "react"
import { 
  DndContext, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragOverlay,
  DragStartEvent, 
  DragEndEvent,
  DragOverEvent,
  defaultDropAnimationSideEffects
} from "@dnd-kit/core"
import { 
  SortableContext, 
  sortableKeyboardCoordinates, 
  rectSortingStrategy,
  useSortable,
  arrayMove
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { getParticipants, getPoolAssignments, updatePoolAssignments, getConfig, getFights } from "@/lib/api"
import { getPairings } from "@/lib/pairings"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Wand2, ExternalLink, GripVertical, CheckCircle2, PlayCircle, Trophy } from "lucide-react"
import Link from "next/link"

// --- Components ---

interface PoolCardData {
    uniqueId: string // "cat-pool"
    category: string
    poolNumber: number
    participantCount: number
    label: string
    participants: string[]
    status: "not_started" | "in_progress" | "finished" | "validated"
    playedCount: number
    totalFights: number
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

    const statusStyles = {
        not_started: "bg-card border-muted hover:border-primary/50",
        in_progress: "bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800",
        finished: "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800",
        validated: "opacity-60 bg-muted/50 border-gray-300 dark:border-gray-700"
    }

    const content = (
        <div className={cn(
            "border rounded-md p-2 shadow-sm select-none flex flex-col gap-1 w-44 transition-colors",
            statusStyles[data.status],
            isOverlay && "cursor-grabbing shadow-xl border-primary"
        )}>
            <div className="flex justify-between items-center border-b pb-1 mb-1">
                <div {...attributes} {...listeners} className="touch-none p-1 -m-1 cursor-grab active:cursor-grabbing">
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-1 flex-1 min-w-0 ml-2">
                    {data.status === "in_progress" && <PlayCircle className="h-2.5 w-2.5 text-blue-500 shrink-0" />}
                    {data.status === "finished" && <CheckCircle2 className="h-2.5 w-2.5 text-green-500 shrink-0" />}
                    {data.status === "validated" && <Trophy className="h-2.5 w-2.5 text-gray-500 shrink-0" />}
                    <span className="font-bold text-[10px] truncate" title={data.label}>{data.label}</span>
                </div>
                <span className="text-[10px] bg-secondary/50 px-1.5 rounded-full">{data.participantCount}</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5 max-h-20 overflow-hidden">
                {data.participants.slice(0, 4).map((name, idx) => (
                    <div key={idx} className="truncate">• {name}</div>
                ))}
                {data.participants.length > 4 && <div className="text-[9px] italic">...</div>}
            </div>
            {data.status === "in_progress" && data.totalFights > 0 && (
                <div className="mt-1">
                    <Progress value={(data.playedCount / data.totalFights) * 100} className="h-1" />
                    <div className="text-[9px] text-right text-muted-foreground mt-0.5">{data.playedCount}/{data.totalFights}</div>
                </div>
            )}
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
    const { setNodeRef, isOver } = useSortable({ id, disabled: true }) 
    const tableId = id.replace("table-", "")
    
    // Calculate total fights
    // Formula: n * (n-1) / 2
    const totalFights = items.reduce((acc, item) => {
        const n = item.participantCount
        const fights = n > 1 ? (n * (n - 1)) / 2 : 0
        return acc + fights
    }, 0)
    
    return (
        <div 
            ref={setNodeRef}
            className={cn(
                "flex flex-col md:flex-row items-start md:items-center gap-4 p-4 border rounded-lg transition-all duration-200",
                isUnassigned 
                    ? (items.length > 0 ? "bg-amber-500/10 border-amber-500/50 border-dashed border-2 min-h-[120px]" : "bg-muted/20 border-dashed border-2 min-h-[120px]") 
                    : "bg-card shadow-sm min-h-[100px]",
                isOver && "ring-4 ring-indigo-500/30 border-indigo-500 bg-indigo-500/5 scale-[1.01]"
            )}
        >
            <div className="w-full md:w-32 shrink-0 flex flex-row md:flex-col justify-between items-center md:items-start gap-2">
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
                    <div className="flex items-center md:flex-col gap-2 md:w-full">
                        <div className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                            {totalFights} combats
                        </div>
                        <Button variant="outline" size="sm" className="text-xs h-7 px-2" asChild>
                            <Link href={`/table/${tableId}`}>
                                <ExternalLink className="mr-1 h-3 w-3" /> Ouvrir
                            </Link>
                        </Button>
                    </div>
                )}
            </div>
            
            <div className="flex-1 flex flex-wrap gap-2 w-full">
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
        useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
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
        try {
            // Fetch Config Fresh
            const confActive = await getConfig("active_categories")
            const activeCats = confActive.value ? confActive.value.split(",") : []
            setActiveCategories(activeCats)

            if (activeCats.length === 0) {
                 toast.warning("Aucune catégorie active trouvée")
                 setColumns({})
                 return
            }

            const [allParticipants, allAssignments, allFights] = await Promise.all([
                getParticipants(),
                getPoolAssignments(),
                getFights()
            ])
            
            // toast.info(`Chargé: ${allParticipants.length} part., ${allAssignments.length} assign., ${allFights.length} combats`)
            
            const poolsMap: Record<string, PoolCardData> = {}
            
            // 1. Group participants by pool
            const normalizedActiveCats = activeCats.map(c => c.trim().toLowerCase())
            
            allParticipants.forEach(p => {
                if (!p.pool_number) return
                if (!normalizedActiveCats.includes(p.category.trim().toLowerCase())) return

                const key = `${p.category}::${p.pool_number}`
                if (!poolsMap[key]) {
                    poolsMap[key] = {
                        uniqueId: key,
                        category: p.category,
                        poolNumber: p.pool_number,
                        participantCount: 0,
                        label: `${p.category} - P${p.pool_number}`,
                        participants: [],
                        status: "not_started",
                        playedCount: 0,
                        totalFights: 0
                    }
                }
                poolsMap[key].participantCount++
                poolsMap[key].participants.push(`${p.firstname} ${p.lastname}`)
            })

            // 2. Determine status for each pool
            // Optimize: Create a set of played pairings for O(1) lookup
            const playedPairings = new Set<string>()
            allFights.forEach(f => {
                // Any fight in the DB is considered played (0-0 are deleted)
                const p1 = Math.min(f.fighter1_id, f.fighter2_id)
                const p2 = Math.max(f.fighter1_id, f.fighter2_id)
                playedPairings.add(`${p1}-${p2}`)
            })

            Object.keys(poolsMap).forEach(key => {
                const pool = poolsMap[key]
                const assignment = allAssignments.find(a => a.category === pool.category && a.pool_number === pool.poolNumber)
                
                if (assignment?.validated) {
                    pool.status = "validated"
                } else {
                    const poolParticipants = allParticipants.filter(p => p.category === pool.category && p.pool_number === pool.poolNumber)
                    const n = poolParticipants.length
                    if (n < 2) {
                        pool.status = "not_started"
                    } else {
                        const sortedP = [...poolParticipants].sort((a, b) => a.weight - b.weight)
                        const pairings = getPairings(n)
                        
                        let playedCount = 0
                        pairings.forEach(pair => {
                            const p1Obj = sortedP[pair[0]-1]
                            const p2Obj = sortedP[pair[1]-1]
                            if (!p1Obj || !p2Obj) return

                            const id1 = Math.min(p1Obj.id, p2Obj.id)
                            const id2 = Math.max(p1Obj.id, p2Obj.id)
                            
                            if (playedPairings.has(`${id1}-${id2}`)) {
                                playedCount++
                            }
                        })

                        pool.playedCount = playedCount
                        pool.totalFights = pairings.length

                        if (playedCount === 0) pool.status = "not_started"
                        else if (playedCount === pairings.length) pool.status = "finished"
                        else pool.status = "in_progress"
                    }
                }
            })

            const assignments = allAssignments.filter(a => 
                normalizedActiveCats.includes(a.category.trim().toLowerCase())
            )
            
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
        if (!confirm("Cela va redistribuer les poules non commencées sur les tables pour équilibrer le nombre de combats. Les poules en cours ou terminées ne seront pas déplacées. Continuer ?")) return

        // 1. Initialize tables and identify fixed pools
        const tableLoads = Array(tableCount).fill(0)
        const newColumns: Record<string, PoolCardData[]> = {}
        for (let i = 1; i <= tableCount; i++) {
            newColumns[`table-${i}`] = []
        }
        newColumns["unassigned"] = []

        // Helper to calc fights
        const getFights = (item: PoolCardData) => {
            const n = item.participantCount
            return n > 1 ? (n * (n - 1)) / 2 : 0
        }

        // 2. Separate movable pools from fixed ones
        const movablePools: PoolCardData[] = []
        
        Object.entries(columns).forEach(([colId, items]) => {
            items.forEach(item => {
                if (item.status !== "not_started" && colId.startsWith("table-")) {
                    // Fixed: Keep in current table and count load
                    const tableIdx = parseInt(colId.replace("table-", "")) - 1
                    newColumns[colId].push(item)
                    tableLoads[tableIdx] += getFights(item)
                } else {
                    // Movable: Unstarted pools or anything in "unassigned"
                    movablePools.push(item)
                }
            })
        })

        // 3. Sort movable pools by fight count descending (Greedy approach)
        movablePools.sort((a, b) => getFights(b) - getFights(a))

        // 4. Distribute movable pools
        movablePools.forEach((item) => {
            // Find table with min load
            let minIndex = 0
            let minLoad = tableLoads[0]
            
            for (let i = 1; i < tableCount; i++) {
                if (tableLoads[i] < minLoad) {
                    minLoad = tableLoads[i]
                    minIndex = i
                }
            }

            // Assign to this table
            newColumns[`table-${minIndex + 1}`].push(item)
            tableLoads[minIndex] += getFights(item)
        })

        setColumns(newColumns)
        saveAll(newColumns)
        toast.success("Répartition équilibrée des nouvelles poules effectuée")
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
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div className="space-y-4">
                     {/* Unassigned Area - Only show if not empty */}
                     {(columns["unassigned"]?.length > 0) && (
                        <TableRow id="unassigned" title="À placer" items={columns["unassigned"]} isUnassigned />
                     )}
                     
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
