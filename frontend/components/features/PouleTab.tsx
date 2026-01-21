"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragOverlay,
  DragStartEvent, 
  DragEndEvent
} from "@dnd-kit/core"
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { getParticipants, updatePools, generatePools, getScoreSheetUrl, updateParticipant, getConfig } from "@/lib/api"
import { toast } from "sonner"
import { GripVertical, Plus, FileDown, RefreshCw, Edit, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Participant } from "@/types"

interface PouleTabProps {
  category: string
}

type ItemType = "participant" | "separator"

interface ListItem {
  id: string
  type: ItemType
  data?: Participant
}

function SortableItem({ id, item, minWeight, maxWeight, onToggleHC }: { id: string, item: ListItem, minWeight: number, maxWeight: number, onToggleHC: (id: number, val: boolean) => void }) {
  const p = item.data
  const hasFights = p?.has_fights || false

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id, disabled: item.type === "participant" && hasFights })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1
  }

  if (item.type === "separator") {
    return (
      <div ref={setNodeRef} style={style} className="py-2 group flex items-center gap-2">
         <div {...attributes} {...listeners} className="touch-none p-1 -m-1 cursor-row-resize opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
         </div>
         <div className="flex-1 h-0.5 bg-border group-hover:bg-primary transition-colors relative flex items-center justify-center">
            <div className="bg-background px-2 text-[10px] text-muted-foreground border rounded-full">Poule</div>
         </div>
      </div>
    )
  }

  // Calculate relative weight percent
  let weightPercent = 0
  if (p && maxWeight > minWeight) {
      weightPercent = ((p.weight - minWeight) / (maxWeight - minWeight)) * 100
  } else {
      weightPercent = 100
  }

  const isHC = p?.hors_categorie || false

  return (
    <div ref={setNodeRef} style={style} className="mb-0.5">
      <div className={cn(
        "flex items-center gap-2 px-2 py-0.5 bg-card border rounded shadow-sm transition-colors border-l-4 h-8", 
        !hasFights && "hover:bg-accent/50",
        p?.sex === 'M' ? "border-l-blue-500" : "border-l-pink-500",
        isHC && "bg-neutral-200/50 dark:bg-neutral-800/50",
        hasFights && "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
      )} title={hasFights ? "Combats déjà joués, déplacement impossible" : ""}>
        {hasFights ? (
            <div className="h-3.5 w-3.5 shrink-0" />
        ) : (
            <div {...attributes} {...listeners} className="touch-none p-1 -m-1 cursor-grab active:cursor-grabbing">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </div>
        )}
        
        <div className="flex-1 flex items-center gap-3 min-w-0">
             <div className="w-1/3 font-semibold truncate text-xs flex items-center gap-2">
                {p?.firstname} {p?.lastname}
             </div>
             <div className="w-1/4 text-[10px] text-muted-foreground truncate">{p?.club}</div>
             <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-[10px] tabular-nums shrink-0">{p?.weight} kg</span>
                <Progress value={weightPercent} className="h-1 flex-1 min-w-[20px]" />
             </div>
        </div>

        {/* Checkbox for Hors Categorie */}
        <div 
          className="flex items-center gap-1 px-2 border-l"
          onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
          onMouseDown={(e) => e.stopPropagation()}
        >
            <input 
                type="checkbox" 
                checked={isHC}
                onChange={(e) => p && onToggleHC(p.id, e.target.checked)}
                className="h-3 w-3 accent-destructive cursor-pointer"
                title="Hors Catégorie"
                disabled={hasFights}
            />
            <span className="text-[9px] text-muted-foreground whitespace-nowrap hidden sm:inline-block">HC</span>
        </div>
      </div>
    </div>
  )
}

export default function PouleTab({ category }: PouleTabProps) {
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [baseUrl, setBaseUrl] = useState<string>("")
  const [activeCategories, setActiveCategories] = useState<string[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getParticipants(category)
      // Convert participants to ListItems with separators
      const newItems: ListItem[] = []
      
      // Group by pool
      const pools: Record<number, Participant[]> = {}
      let maxPool = 0
      
      // Find unassigned (pool 0 or null)
      const unassigned: Participant[] = []

      data.forEach(p => {
         if (p.pool_number) {
            if (!pools[p.pool_number]) pools[p.pool_number] = []
            pools[p.pool_number].push(p)
            maxPool = Math.max(maxPool, p.pool_number)
         } else {
            unassigned.push(p)
         }
      })

      // Construct list: Pool 1, Separator, Pool 2, Separator...
      // Sort keys
      const sortedPoolNums = Object.keys(pools).map(Number).sort((a,b) => a-b)
      
      sortedPoolNums.forEach((num, idx) => {
         // Sort participants within the pool by weight
         const sortedPoolParticipants = [...pools[num]].sort((a, b) => a.weight - b.weight)
         
         sortedPoolParticipants.forEach(p => {
             newItems.push({ id: `p-${p.id}`, type: "participant", data: p })
         })
         // Add separator if not last pool
         if (idx < sortedPoolNums.length - 1) {
             newItems.push({ id: `sep-${num}`, type: "separator" })
         }
      })

      // Add unassigned at the bottom with a separator if there are existing pools
      if (unassigned.length > 0) {
          if (sortedPoolNums.length > 0) {
              newItems.push({ id: `sep-unassigned`, type: "separator" })
          }
          unassigned.forEach(p => {
               newItems.push({ id: `p-${p.id}`, type: "participant", data: p })
          })
      }

      setItems(newItems)
    } catch {
      toast.error("Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => {
    if (category) loadData()
    if (typeof window !== "undefined") {
        setBaseUrl(window.location.origin)
    }
    // Load config
    getConfig("active_categories").then(c => {
        if (c.value) setActiveCategories(c.value.split(","))
    })
  }, [category, loadData])

  const { minWeight, maxWeight } = useMemo(() => {
    let min = Infinity
    let max = 0
    let hasData = false
    items.forEach(item => {
        if (item.data) {
            hasData = true
            min = Math.min(min, item.data.weight)
            max = Math.max(max, item.data.weight)
        }
    })
    return { 
        minWeight: hasData ? min : 0, 
        maxWeight: hasData ? max : 0 
    }
  }, [items])

  const hasAnyFights = useMemo(() => {
    return items.some(item => item.type === "participant" && item.data?.has_fights)
  }, [items])

  const handleGenerate = async () => {
     if (!confirm("Attention, cela va écraser les poules actuelles. Continuer ?")) return
     setLoading(true)
     try {
         await generatePools(category)
         await loadData()
         toast.success("Poules générées")
     } catch {
         toast.error("Erreur lors de la génération")
     }
     finally {
         setLoading(false)
     }
  }

  const handleAddSeparator = () => {
      // Add a separator at the end
      const newId = `sep-${Date.now()}`
      setItems([...items, { id: newId, type: "separator" }])
  }

  const handleToggleHC = async (participantId: number, isHC: boolean) => {
      // Optimistic update
      setItems(current => current.map(item => {
          if (item.type === 'participant' && item.data!.id === participantId) {
              return { ...item, data: { ...item.data!, hors_categorie: isHC } }
          }
          return item
      }))

      try {
          await updateParticipant(participantId, { hors_categorie: isHC })
      } catch {
          toast.error("Erreur lors de la mise à jour")
          // Revert on error
          loadData()
      }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        
        const newItems = arrayMove(items, oldIndex, newIndex)
        
        // Clean up double separators or separators at edges if needed?
        // For now, let's keep it simple and just save the state.
        // Actually, we need to save the pool numbers to the backend.
        
        // Debounce or immediate save? Immediate is safer for consistency.
        savePoolConfiguration(newItems)
        
        return newItems
      })
    }
  }

  const savePoolConfiguration = async (currentItems: ListItem[]) => {
      const updates: { id: number, pool_number: number }[] = []
      
      // Extract groups of participants separated by separators
      const groups: ListItem[][] = []
      let currentGroup: ListItem[] = []
      
      currentItems.forEach(item => {
          if (item.type === 'separator') {
              groups.push(currentGroup)
              currentGroup = []
          } else if (item.type === 'participant') {
              currentGroup.push(item)
          }
      })
      groups.push(currentGroup)
      
      // Assign pool numbers only to non-empty groups (effectively deleting empty pools)
      let poolCounter = 1
      const nonEmptyGroups = groups.filter(g => g.length > 0)

      nonEmptyGroups.forEach(group => {
          group.forEach(item => {
               if (item.data) {
                   updates.push({ id: item.data.id, pool_number: poolCounter })
               }
          })
          poolCounter++
      })

      try {
          await updatePools(updates)
          
          // Update local state to remove empty separators
          const newOptimizedItems: ListItem[] = []
          nonEmptyGroups.forEach((group, idx) => {
              group.forEach(item => newOptimizedItems.push(item))
              // Add separator only between groups
              if (idx < nonEmptyGroups.length - 1) {
                  // Reuse existing separator ID if possible or generate new
                  // Ideally we should track which separator was where, but regenerating is safer for list integrity
                  newOptimizedItems.push({ id: `sep-${Date.now()}-${idx}`, type: 'separator' })
              }
          })
          
          setItems(newOptimizedItems)
          
      } catch {
          toast.error("Erreur de sauvegarde")
          loadData() 
      }
  }

  if (!category) return <div className="p-8 text-center">Sélectionnez une catégorie</div>

  return (
    <div className="py-4 space-y-4">
       {activeCategories.includes(category) && (
           <Alert variant="destructive" className="bg-orange-100 border-orange-200 text-orange-800 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-300">
               <TriangleAlert className="h-4 w-4 text-orange-600 dark:text-orange-400" />
               <AlertTitle>Attention</AlertTitle>
               <AlertDescription>
                   Cette catégorie est active (En Cours). Modifier les poules peut impacter les matchs en cours.
               </AlertDescription>
           </Alert>
       )}

       <div className="flex justify-between items-center bg-card p-4 rounded-lg border">
           <div className="flex gap-2">
               {!hasAnyFights && (
                   <Button onClick={handleGenerate} disabled={loading}>
                       <RefreshCw className="mr-2 h-4 w-4" /> Générer Auto
                   </Button>
               )}
               <Button variant="secondary" onClick={handleAddSeparator}>
                   <Plus className="mr-2 h-4 w-4" /> Ajouter Poule
               </Button>
           </div>
           <Button variant="outline" asChild>
               <a href={getScoreSheetUrl(category, baseUrl)} target="_blank" rel="noreferrer">
                   <FileDown className="mr-2 h-4 w-4" /> Feuilles de Score (PDF)
               </a>
           </Button>
       </div>

       <div className="max-w-3xl mx-auto px-4">
          <DndContext 
            sensors={sensors} 
            collisionDetection={closestCenter} 
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
             <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5 pb-20">
                    {items.map((item, index) => (
                        <div key={item.id}>
                            {/* Visual Pool Header for the first item or after separator */}
                            {(index === 0 || items[index-1].type === "separator") && (
                                <div className="flex items-center justify-between my-2 pl-2 pr-2">
                                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                        Poule {items.slice(0, index).filter(i => i.type === "separator").length + 1}
                                        <span className="normal-case font-normal text-muted-foreground/70">
                                            ({items.slice(index).findIndex(item => item.type === "separator") === -1 
                                                ? items.slice(index).length 
                                                : items.slice(index).findIndex(item => item.type === "separator")
                                            } participants)
                                        </span>
                                    </div>
                                    <Button variant="ghost" className="h-6 text-[10px] px-2" asChild>
                                        <Link href={`/score_poule/${encodeURIComponent(category)}/${items.slice(0, index).filter(i => i.type === "separator").length + 1}`}>
                                            <Edit className="mr-1 h-3 w-3" /> Saisir Scores
                                        </Link>
                                    </Button>
                                </div>
                            )}
                            <SortableItem id={item.id} item={item} minWeight={minWeight} maxWeight={maxWeight} onToggleHC={handleToggleHC} />
                        </div>
                    ))}
                </div>
             </SortableContext>
             <DragOverlay>
                {activeId ? (
                    <Card className="p-3 opacity-80 cursor-grabbing">
                        <div className="font-semibold">Déplacement...</div>
                    </Card>
                ) : null}
             </DragOverlay>
          </DndContext>
       </div>
    </div>
  )
}