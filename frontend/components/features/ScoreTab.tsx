"use client"

import { useState, useEffect, useCallback } from "react"
import { getParticipants, getFights, getPoolAssignments, validatePool } from "@/lib/api"
import { getPairings } from "@/lib/pairings"
import { getPoolStatus, formatParticipantName, sortParticipantsByRank } from "@/lib/judo"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Participant, Fight } from "@/types"
import { cn } from "@/lib/utils"
import { Trophy } from "lucide-react"

interface ScoreTabProps {
  categoryName: string
}

export default function ScoreTab({ categoryName }: ScoreTabProps) {
  const [pools, setPools] = useState<Record<number, Participant[]>>({})
  const [finishedPools, setFinishedPools] = useState<Set<number>>(new Set())
  const [validatedPools, setValidatedPools] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [data, fightsData, assignments] = await Promise.all([
          getParticipants(categoryName),
          getFights(categoryName),
          getPoolAssignments()
      ])

      // Process Validation Status
      const validated = new Set<number>()
      const finished = new Set<number>()

      assignments.forEach(a => {
          if (a.category_name?.trim().toLowerCase() === categoryName.trim().toLowerCase() && a.validated) {
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
      Object.keys(grouped).forEach(poolNumStr => {
          const poolNum = parseInt(poolNumStr)
          if (poolNum === 0) return
          const poolParticipants = grouped[poolNum]
          const { status } = getPoolStatus(poolParticipants, fightsData)
          if (status === "finished") {
              finished.add(poolNum)
          }
      })
      setFinishedPools(finished)

    } catch {
      toast.error("Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [categoryName])

  useEffect(() => {
    if (categoryName) loadData()
  }, [categoryName, loadData])

  const handleValidate = async (poolNum: number) => {
      if (!confirm("Confirmer que le podium a été fait pour cette poule ?")) return
      
      const poolParticipants = pools[poolNum] || []
      const firstParticipant = poolParticipants[0]
      if (!firstParticipant || !firstParticipant.category_id) {
          return toast.error("Impossible de déterminer la catégorie")
      }

      try {
          await validatePool(firstParticipant.category_id, poolNum, true)
          toast.success("Poule validée")
          loadData()
      } catch {
          toast.error("Erreur validation")
      }
  }

  if (!categoryName) return <div className="p-8 text-center">Sélectionnez une catégorie</div>

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
                    <CardContent className="grid gap-6">
                                        {(() => {
                                            // 1. Separate Non-HC and HC
                                            const nonHC = sortParticipantsByRank(participants.filter(p => !p.hors_categorie))
                                            const hcList = sortParticipantsByRank(participants.filter(p => p.hors_categorie))
                    
                                            // 2. Define sections: [ { title: string, list: Participant[], hasRank: boolean } ]
                                            const sections = []
                                            if (nonHC.length > 0) {
                                                // Calculate ranks for nonHC (Dense Ranking)
                                                let currentRank = 0
                                                let prevVictories = -1
                                                let prevScore = -1
                                                
                                                const listWithRanks = nonHC.map((p) => {
                                                    const pVictories = p.victories ?? 0
                                                    const pScore = p.score ?? 0
                                                    if (pVictories !== prevVictories || pScore !== prevScore) {
                                                        currentRank++
                                                    }
                                                    prevVictories = pVictories
                                                    prevScore = pScore
                                                    return { ...p, rank: currentRank }
                                                })
                                                
                                                sections.push({ title: "Classement Officiel", list: listWithRanks, hasRank: true })
                                            }
                                            hcList.forEach((p, idx) => {
                                                sections.push({ title: `Hors Catégorie ${hcList.length > 1 ? idx + 1 : ""}`, list: [p], hasRank: false })
                                            })
                    
                                            return sections.map((sec, sIdx) => (
                                                <div key={sIdx} className="space-y-3">
                                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 pb-1 flex justify-between items-center">
                                                        <span>{sec.title}</span>
                                                        {sec.list.length > 1 && <span className="lowercase font-normal">({sec.list.length} participants)</span>}
                                                    </div>
                                                    <div className="grid gap-3">
                                                        {sec.list.map((p: any) => (
                                                            <div key={p.id} className={cn(
                                                                "flex items-center gap-4 pb-2 last:border-0",
                                                                sec.list.length > 1 && "border-b border-slate-100"
                                                            )}>
                                                                {sec.hasRank && (isFinished || isValidated) && (
                                                                    <div className={cn(
                                                                        "w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shadow-sm shrink-0",
                                                                        p.rank === 1 ? "bg-amber-400 text-amber-950" : 
                                                                        p.rank === 2 ? "bg-slate-300 text-slate-900" :
                                                                        p.rank >= 3 ? "bg-orange-300 text-orange-950" : "bg-slate-100 text-slate-500"
                                                                    )}>
                                                                        {p.rank}
                                                                    </div>
                                                                )}
                                                                <div className="flex-1 font-medium">
                                                                    <span className="flex items-center gap-2">
                                                                        {formatParticipantName(p)}
                                                                        {p.hors_categorie && <Badge variant="outline" className="text-[8px] h-3 px-1 border-rose-500 text-rose-500 font-black">HC</Badge>}
                                                                    </span>
                                                                    <div className="text-[10px] text-muted-foreground font-normal">{p.club_name}</div>
                                                                </div>
                    
                                            <Badge variant="secondary" className="text-[10px] h-5 bg-slate-100 border-none">{p.weight} kg</Badge>
                                            
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <span className="text-[8px] text-slate-400 uppercase font-bold">Vict.</span>
                                                    <div className="w-12 text-center py-1 bg-slate-50 rounded font-mono font-bold text-sm">
                                                        {p.victories ?? 0}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <span className="text-[8px] text-slate-400 uppercase font-bold">Pts</span>
                                                    <div className="w-12 text-center py-1 bg-slate-50 rounded font-mono font-bold text-sm text-indigo-600">
                                                        {p.score ?? 0}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    })()}
                </CardContent>
            </Card>
            )
        })}
    </div>
  )
}
