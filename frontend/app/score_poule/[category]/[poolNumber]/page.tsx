"use client"

import { useState, useEffect, use, useCallback } from "react"
import { getParticipants } from "@/lib/api"
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

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/">
            <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
            </Button>
        </Link>
        <div>
            <h1 className="text-2xl font-bold">Résultats</h1>
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
                                <div className="text-sm text-muted-foreground">{p.club_name}</div>
                            </div>
                            
                            <Badge variant="secondary" className="text-sm h-8 px-3">
                                {p.weight} kg
                            </Badge>

                            <div className="flex items-center gap-4">
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-xs text-muted-foreground uppercase font-bold">Vict.</span>
                                    <span className="text-xl font-mono font-bold">{p.victories ?? 0}</span>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-xs text-muted-foreground uppercase font-bold">Pts</span>
                                    <span className="text-xl font-mono font-bold">{p.score ?? 0}</span>
                                </div>
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
