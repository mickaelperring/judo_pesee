"use client"

import { useState, useEffect, use, useCallback } from "react"
import { getParticipants, updateParticipant } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Participant } from "@/types"

export default function PoolScorePage({ params }: { params: Promise<{ category: string, poolNumber: string }> }) {
  // Unwrap params using React.use()
  const { category, poolNumber } = use(params)
  const decodedCategory = decodeURIComponent(category)
  
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch all for category, then filter locally
      const data = await getParticipants(decodedCategory)
      const filtered = data.filter(p => p.pool_number === parseInt(poolNumber))
      // Sort by name or weight? usually standard order
      filtered.sort((a, b) => a.lastname.localeCompare(b.lastname))
      setParticipants(filtered)
    } catch {
      toast.error("Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [decodedCategory, poolNumber])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleScoreChange = async (id: number, score: string) => {
     const val = parseInt(score)
     if (isNaN(val) && score !== "") return 
     if (val < 0 || val > 50) return toast.error("Score entre 0 et 50")
     
     // Allow empty string to clear? Logic says default=None.
     // If empty string, maybe don't update or set null?
     // For now assume valid int.
     if (score === "") return 

     try {
         await updateParticipant(id, { score: val })
         toast.success("Score enregistré")
     } catch {
         toast.error("Erreur sauvegarde")
     }
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/">
            <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
            </Button>
        </Link>
        <div>
            <h1 className="text-2xl font-bold">Saisie des Scores</h1>
            <p className="text-muted-foreground">{decodedCategory} - Poule {poolNumber}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
            <CardTitle className="flex justify-between items-center">
                <span>Participants</span>
                {!loading && participants.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">{participants.length} participants</span>
                )}
            </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
            {loading ? (
                <div className="text-center p-4">Chargement...</div>
            ) : participants.length === 0 ? (
                <div className="text-center p-4 text-muted-foreground">Aucun participant dans cette poule.</div>
            ) : (
                participants.map(p => (
                    <div key={p.id} className="flex items-center gap-4 border-b last:border-0 pb-4 last:pb-0">
                            <div className="flex-1">
                                <div className="font-semibold text-lg">{p.lastname} {p.firstname}</div>
                                <div className="text-sm text-muted-foreground">{p.club}</div>
                            </div>
                            
                            <Badge variant="secondary" className="text-sm h-8 px-3">
                                {p.weight} kg
                            </Badge>

                            <div className="flex items-center gap-2">
                                <Label className="sr-only">Score</Label>
                                <Input 
                                className="w-24 text-center text-lg h-12" 
                                type="number" 
                                min="0" 
                                max="50" 
                                defaultValue={p.score ?? ""}
                                onBlur={(e) => handleScoreChange(p.id, e.target.value)}
                                />
                            </div>
                    </div>
                ))
            )}
        </CardContent>
      </Card>
    </div>
  )
}

function Label({ className, children }: { className?: string, children: React.ReactNode }) {
    return <span className={className}>{children}</span>
}
