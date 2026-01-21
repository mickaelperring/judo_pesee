"use client"

import { useState, useEffect, useCallback } from "react"
import { getParticipants, getFights, getPoolAssignments, validatePool } from "@/lib/api"
import { getPairings } from "@/lib/pairings"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Participant, Fight } from "@/types"
import { cn } from "@/lib/utils"
import { Trophy } from "lucide-react"

interface ScoreTabProps {
  category: string
}

export default function ScoreTab({ category }: ScoreTabProps) {
  const [pools, setPools] = useState<Record<number, Participant[]>>({})
  const [finishedPools, setFinishedPools] = useState<Set<number>>(new Set())
  const [validatedPools, setValidatedPools] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [data, fightsData, assignments] = await Promise.all([
          getParticipants(category),
          getFights(category),
          getPoolAssignments()
      ])

      // Process Validation Status
      const validated = new Set<number>()
      assignments.forEach(a => {
          if (a.category.trim().toLowerCase() === category.trim().toLowerCase() && a.validated) {
              validated.add(a.pool_number)
          }
      })
      setValidatedPools(validated)

      const grouped: Record<number, Participant[]> = {}
      data.forEach(p => {
         const pool = p.pool_number || 0
         if (!grouped[pool]) grouped[pool] = []
         grouped[pool].push(p)
      })
      setPools(grouped)

      // Logic to determine finished pools
      const finished = new Set<number>()
      Object.keys(grouped).forEach(poolNumStr => {
          const poolNum = parseInt(poolNumStr)
          if (poolNum === 0) return

          const poolParticipants = grouped[poolNum]
          if (poolParticipants.length < 2) return

          // Generate pairings for this pool
          // Use the same sort logic as TableMatchView
          const sortedPoolParticipants = [...poolParticipants].sort((a, b) => a.weight - b.weight)
          const n = sortedPoolParticipants.length
          const pairings = getPairings(n)

          // Check if all expected pairings have a corresponding fight with a winner
          const allPlayed = pairings.every(pair => {
              const p1Id = sortedPoolParticipants[pair[0] - 1].id
              const p2Id = sortedPoolParticipants[pair[1] - 1].id
              
              return fightsData.some(f => 
                  f.winner_id !== null &&
                  ((f.fighter1_id === p1Id && f.fighter2_id === p2Id) || 
                   (f.fighter1_id === p2Id && f.fighter2_id === p1Id))
              )
          })

          if (allPlayed) {
              finished.add(poolNum)
          }
      })
      setFinishedPools(finished)

    } catch {
      toast.error("Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => {
    if (category) loadData()
  }, [category, loadData])

  const handleValidate = async (poolNum: number) => {
      if (!confirm("Confirmer que le podium a été fait pour cette poule ?")) return
      try {
          await validatePool(category, poolNum, true)
          toast.success("Poule validée")
          loadData()
      } catch {
          toast.error("Erreur validation")
      }
  }

  if (!category) return <div className="p-8 text-center">Sélectionnez une catégorie</div>

  // Sorting Logic
  // 1. Finished & NOT Validated
  // 2. Others (Unfinished)
  // 3. Finished & Validated
  const sortedPools = Object.entries(pools).sort((a, b) => {
      const poolNumA = parseInt(a[0])
      const poolNumB = parseInt(b[0])

      const isFinishedA = finishedPools.has(poolNumA)
      const isFinishedB = finishedPools.has(poolNumB)
      const isValidatedA = validatedPools.has(poolNumA)
      const isValidatedB = validatedPools.has(poolNumB)

      // Define priorities (Lower is higher up)
      const getPriority = (finished: boolean, validated: boolean) => {
          if (validated) return 3
          if (finished) return 1
          return 2
      }

      const prioA = getPriority(isFinishedA, isValidatedA)
      const prioB = getPriority(isFinishedB, isValidatedB)

      if (prioA !== prioB) return prioA - prioB
      
      // Secondary sort by pool number
      return poolNumA - poolNumB
  })

  return (
    <div className="py-4 space-y-6">
        {loading && <div className="text-center">Chargement...</div>}
        {sortedPools.map(([poolNumStr, participants]) => {
            const poolNum = parseInt(poolNumStr)
            const isFinished = finishedPools.has(poolNum)
            const isValidated = validatedPools.has(poolNum)
            
            return (
                <Card key={poolNum} className={cn(
                    "transition-colors border-l-4",
                    isFinished && !isValidated && "border-l-green-500 bg-green-50/30 dark:bg-green-900/10",
                    isValidated && "opacity-60 bg-muted/30 border-l-gray-400"
                )}>
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span>Poule {poolNum === 0 ? "Non assignée" : poolNum}</span>
                                {isFinished && !isValidated && (
                                    <Badge className="bg-green-600 hover:bg-green-600 text-white text-[10px] h-5 px-2">
                                        Terminée
                                    </Badge>
                                )}
                                {isValidated && (
                                    <Badge variant="outline" className="text-[10px] h-5 px-2">
                                        Podium Fait
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-normal text-muted-foreground">{participants.length} participants</span>
                                {isFinished && !isValidated && (
                                    <Button 
                                        size="default" 
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleValidate(poolNum)
                                        }} 
                                        className="bg-green-600 hover:bg-green-700 shadow-sm"
                                    >
                                        <Trophy className="mr-2 h-4 w-4" />
                                        Valider Podium
                                    </Button>
                                )}
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                    {participants.map(p => (
                        <div key={p.id} className="flex items-center gap-4 border-b last:border-0 pb-2 last:pb-0">
                             <div className="w-8 font-mono text-muted-foreground">{p.id}</div>
                             <div className="flex-1 font-medium">
                                 {p.lastname} {p.firstname}
                                 <div className="text-xs text-muted-foreground font-normal">{p.club}</div>
                             </div>
                             <Badge variant="outline">{p.weight} kg</Badge>
                             
                             <div className="flex items-center gap-3">
                                 <div className="flex flex-col items-center gap-1">
                                     <span className="text-[10px] text-muted-foreground uppercase font-bold">Vict.</span>
                                     <div className="w-16 text-center py-2 bg-muted rounded font-mono font-bold">
                                         {p.victories ?? 0}
                                     </div>
                                 </div>
                                 <div className="flex flex-col items-center gap-1">
                                     <span className="text-[10px] text-muted-foreground uppercase font-bold">Pts</span>
                                     <div className="w-16 text-center py-2 bg-muted rounded font-mono font-bold">
                                         {p.score ?? 0}
                                     </div>
                                 </div>
                             </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
            )
        })}
    </div>
  )
}
