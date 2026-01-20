"use client"

import { useState, useEffect, useCallback } from "react"
import { getParticipants, updateParticipant } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Participant } from "@/types"

interface ScoreTabProps {
  category: string
}

export default function ScoreTab({ category }: ScoreTabProps) {
  const [pools, setPools] = useState<Record<number, Participant[]>>({})
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getParticipants(category)
      const grouped: Record<number, Participant[]> = {}
      data.forEach(p => {
         const pool = p.pool_number || 0
         if (!grouped[pool]) grouped[pool] = []
         grouped[pool].push(p)
      })
      setPools(grouped)
    } catch {
      toast.error("Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => {
    if (category) loadData()
  }, [category, loadData])

  const handleScoreChange = async (id: number, score: string) => {
     const val = parseInt(score)
     if (isNaN(val)) return 
     if (val < 0 || val > 50) return toast.error("Score entre 0 et 50")
     
     try {
         await updateParticipant(id, { score: val })
         toast.success("Score enregistré")
     } catch {
         toast.error("Erreur sauvegarde")
     }
  }

  if (!category) return <div className="p-8 text-center">Sélectionnez une catégorie</div>

  return (
    <div className="py-4 space-y-6">
        {loading && <div className="text-center">Chargement...</div>}
        {Object.entries(pools).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).map(([poolNum, participants]) => (
            <Card key={poolNum}>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        <span>Poule {poolNum === "0" ? "Non assignée" : poolNum}</span>
                        <span className="text-sm font-normal text-muted-foreground">{participants.length} participants</span>
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
                             <div className="flex items-center gap-2">
                                 <span className="text-sm">Score:</span>
                                 <Input 
                                    className="w-20" 
                                    type="number" 
                                    min="0" 
                                    max="50" 
                                    defaultValue={p.score ?? ""}
                                    onBlur={(e) => handleScoreChange(p.id, e.target.value)}
                                 />
                             </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        ))}
    </div>
  )
}
