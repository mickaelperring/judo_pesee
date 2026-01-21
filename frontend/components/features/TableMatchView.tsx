"use client"

import { useState, useEffect, useCallback } from "react"
import { getParticipants, getPoolAssignments, getFights, createFights, updateFight, deleteFight, getConfig } from "@/lib/api"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { NumberInput } from "@/components/ui/number-input"
import { cn } from "@/lib/utils"
import { getPairings } from "@/lib/pairings"
import { Participant, Fight, PoolAssignment } from "@/types"
import { Loader2, Trophy, ArrowLeft, Scale } from "lucide-react"
import Link from "next/link"

interface TableMatchViewProps {
    tableId: string
}

// Helper to sort participants for deterministic pairings
const sortParticipantsForPairing = (participants: Participant[]) => {
    // Sort by Weight (standard) to ensure deterministic order
    return [...participants].sort((a, b) => a.weight - b.weight)
}

export default function TableMatchView({ tableId }: TableMatchViewProps) {
    const [loading, setLoading] = useState(true)
    const [pools, setPools] = useState<PoolAssignment[]>([])
    const [participants, setParticipants] = useState<Participant[]>([])
    const [allFights, setAllFights] = useState<Fight[]>([])
    const [fights, setFights] = useState<(Fight & { computedOrder: number })[]>([])
    const [activePool, setActivePool] = useState<string | null>(null) // "cat-poolNum"
    const [selectedFight, setSelectedFight] = useState<Fight | null>(null)
    const [score1, setScore1] = useState(0)
    const [score2, setScore2] = useState(0)
    const [manualWinner, setManualWinner] = useState<string>("0")

    const loadData = useCallback(async (isBackground = false) => {
        try {
            // 1. Config
            const confActive = await getConfig("active_categories")
            const activeCats = confActive.value ? confActive.value.split(",") : []

            // 2. Assignments
            const allAssignments = await getPoolAssignments()
            const tableAssignments = allAssignments.filter(a => 
                a.table_number === parseInt(tableId) && activeCats.includes(a.category)
            ).sort((a, b) => a.order - b.order)
            setPools(tableAssignments)

            // 3. Participants & Fights
            const [allParticipants, fightsData] = await Promise.all([
                getParticipants(),
                getFights()
            ])
            setParticipants(allParticipants)
            setAllFights(fightsData)
        } catch {
            if (!isBackground) toast.error("Erreur de chargement")
        } finally {
            if (!isBackground) setLoading(false)
        }
    }, [tableId])

    useEffect(() => {
        loadData()
        const interval = setInterval(() => loadData(true), 5000)
        return () => clearInterval(interval)
    }, [loadData])

    // Reload fights for active pool
    const loadActivePoolFights = async (category: string, poolNumber: number) => {
        const poolFights = await getFights(category, poolNumber)
        
        // Compute active participants for this pool
        const poolParticipants = participants.filter(p => p.category === category && p.pool_number === poolNumber)
        
        // Sort for pairing generation
        const sortedPoolParticipants = sortParticipantsForPairing(poolParticipants)
        const n = sortedPoolParticipants.length
        const pairings = getPairings(n)
        
        // Map fights to pairings
        const mappedFights = mapFightsToOrder(poolFights, pairings, sortedPoolParticipants, category)
        setFights(mappedFights)
    }

    const mapFightsToOrder = (
        existingFights: Fight[], 
        pairings: number[][], 
        sortedParticipants: Participant[],
        category: string
    ) => {
        const result: (Fight & { computedOrder: number })[] = []
        
        // For each pairing, find the corresponding fight or create placeholder
        pairings.forEach((pair, idx) => {
            const p1 = sortedParticipants[pair[0] - 1]
            const p2 = sortedParticipants[pair[1] - 1]
            
            if (!p1 || !p2) return

            // Find fight matching these two IDs
            const fight = existingFights.find(f => 
                (f.fighter1_id === p1.id && f.fighter2_id === p2.id) || 
                (f.fighter1_id === p2.id && f.fighter2_id === p1.id)
            )

            if (fight) {
                result.push({ ...fight, computedOrder: idx + 1 })
            } else {
                // Placeholder
                result.push({
                    id: -1, // Indicates not saved
                    category,
                    fighter1_id: p1.id,
                    fighter2_id: p2.id,
                    score1: 0,
                    score2: 0,
                    winner_id: null,
                    computedOrder: idx + 1
                } as Fight & { computedOrder: number })
            }
        })
        
        return result
    }

    const handlePoolClick = (p: PoolAssignment) => {
        const key = `${p.category}-${p.pool_number}`
        if (activePool === key) {
            setActivePool(null) // Collapse
        } else {
            setActivePool(key)
            loadActivePoolFights(p.category, p.pool_number)
        }
    }

    const handleFightClick = (f: Fight) => {
        setScore1(f.score1)
        setScore2(f.score2)
        setManualWinner(f.winner_id === f.fighter1_id ? "1" : f.winner_id === f.fighter2_id ? "2" : "0")
        setSelectedFight(f)
    }

    const getEffectiveWinner = () => {
        if (score1 > score2) return "1"
        if (score2 > score1) return "2"
        if (score1 === 1 && score2 === 1) return manualWinner
        return "0"
    }

    const effectiveWinner = getEffectiveWinner()
    const isManualAllowed = score1 === 1 && score2 === 1

    const handleScoreSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedFight) return
        
        // Check if this is a reset (0-0 and no winner selected)
        // Note: Manual winner is only allowed if score is 1-1, so if score is 0-0, winnerId is null.
        const isReset = score1 === 0 && score2 === 0
        
        const winnerId = effectiveWinner === "1" ? selectedFight.fighter1_id : 
                         effectiveWinner === "2" ? selectedFight.fighter2_id : null

        try {
            if (isReset) {
                // If it's a reset, we delete the fight if it exists
                if (selectedFight.id !== -1) {
                    await deleteFight(selectedFight.id)
                    toast.success("Combat réinitialisé")
                } else {
                    // It wasn't saved yet, so just close the dialog
                    toast.info("Aucun changement enregistré")
                }
            } else {
                const fightData = {
                    score1: score1,
                    score2: score2,
                    winner_id: winnerId,
                    // Ensure we send required fields for creation
                    category: selectedFight.category,
                    fighter1_id: selectedFight.fighter1_id,
                    fighter2_id: selectedFight.fighter2_id
                }

                if (selectedFight.id === -1) {
                    // Create
                    await createFights([fightData])
                } else {
                    // Update
                    await updateFight(selectedFight.id, fightData)
                }
                toast.success("Combat enregistré")
            }
            
            setSelectedFight(null)
            
            if (activePool) {
                const [cat, num] = activePool.split("-")
                await loadActivePoolFights(cat, parseInt(num))
                // Refresh stats
                const all = await getParticipants()
                setParticipants(all)
            }
        } catch {
            toast.error("Erreur sauvegarde")
        }
    }

    // Helpers
    const getParticipant = (id: number) => participants.find(p => p.id === id)

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>

    return (
        <div className="container mx-auto p-4 max-w-lg pb-20">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/">
                    <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4"/></Button>
                </Link>
                <div>
                    <h1 className="text-xl font-bold">Table {tableId}</h1>
                    <p className="text-muted-foreground text-sm">Matchs en cours</p>
                </div>
            </div>

            <div className="space-y-4">
                {pools.length === 0 && <div className="text-center text-muted-foreground py-8">Aucun match assigné.</div>}
                
                {pools.map(pool => {
                    const isActive = activePool === `${pool.category}-${pool.pool_number}`
                    const poolParticipants = participants.filter(p => p.category === pool.category && p.pool_number === pool.pool_number)
                    
                    // Determine Status
                    let status = "not_started"
                    if (pool.validated) {
                        status = "validated"
                    } else if (poolParticipants.length >= 2) {
                        const sortedP = [...poolParticipants].sort((a, b) => a.weight - b.weight)
                        const pairings = getPairings(sortedP.length)
                        
                        let playedCount = 0
                        pairings.forEach(pair => {
                            const p1 = sortedP[pair[0]-1]
                            const p2 = sortedP[pair[1]-1]
                            const fight = allFights.find(f => 
                                f.winner_id !== null &&
                                ((f.fighter1_id === p1.id && f.fighter2_id === p2.id) || 
                                 (f.fighter1_id === p2.id && f.fighter2_id === p1.id))
                            )
                            if (fight) playedCount++
                        })

                        if (playedCount > 0) {
                            status = playedCount === pairings.length ? "finished" : "in_progress"
                        }
                    }

                    const statusStyles = {
                        not_started: isActive ? "bg-muted/50" : "hover:bg-muted/20",
                        in_progress: "bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800",
                        finished: "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800",
                        validated: "opacity-60 bg-muted/50 border-gray-300 dark:border-gray-700"
                    }

                    return (
                        <div key={pool.id} className="space-y-2">
                            {/* Pool Card */}
                            <Card 
                                className={cn(
                                    "cursor-pointer transition-colors border-l-4 border-l-primary",
                                    // @ts-ignore
                                    statusStyles[status]
                                )}
                                onClick={() => handlePoolClick(pool)}
                            >
                                <CardHeader className="p-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-base">{pool.category} - Poule {pool.pool_number}</CardTitle>
                                        <Badge variant="secondary">{poolParticipants.length} combattants</Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {poolParticipants.map(p => `${p.firstname} ${p.lastname}`).join(", ")}
                                    </div>
                                </CardHeader>
                            </Card>

                            {/* Fights List (Expanded) */}
                            {isActive && (
                                <div className="pl-4 space-y-2 border-l-2 ml-2 mb-6 animate-in slide-in-from-top-2">
                                    {fights.map(fight => {
                                        const p1 = getParticipant(fight.fighter1_id)
                                        const p2 = getParticipant(fight.fighter2_id)
                                        if (!p1 || !p2) return null
                                        
                                        const isSaved = fight.id !== -1
                                        const isPlayed = isSaved && fight.winner_id !== null
                                        const isDraw = isSaved && fight.winner_id === null
                                        
                                        return (
                                            <Card 
                                                key={fight.id === -1 ? `temp-${fight.computedOrder}` : fight.id} 
                                                className={cn(
                                                    "cursor-pointer hover:bg-accent transition-colors",
                                                    isPlayed && "bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-800"
                                                )} 
                                                onClick={() => handleFightClick(fight)}
                                            >
                                                <CardContent className="p-3">
                                                    <div className="flex items-center justify-between gap-2 text-sm">
                                                        <div className="flex-1 text-right">
                                                            <div className={cn(
                                                                "flex items-center justify-end gap-1 font-semibold", 
                                                                isSaved && fight.winner_id !== p1.id && !isDraw ? "text-red-600/50" : "text-red-600"
                                                            )}>
                                                                {fight.winner_id === p1.id && <Trophy className="h-3 w-3 text-amber-500 shrink-0" />}
                                                                <span className="truncate">{p1.firstname} {p1.lastname}</span>
                                                            </div>
                                                            <div className="text-[10px] text-muted-foreground">{p1.club} {p1.hors_categorie && "(HC)"}</div>
                                                            <div className="text-[10px] text-muted-foreground">V: {p1.victories} - P: {p1.score}</div>
                                                        </div>
                                                        
                                                        <div className="flex flex-col items-center px-2 bg-muted/30 rounded min-w-[60px]">
                                                            {isDraw && <Scale className="h-3 w-3 text-blue-500 mb-0.5" />}
                                                            <span className="font-mono font-bold text-lg">{fight.score1} - {fight.score2}</span>
                                                            <span className="text-[10px] text-muted-foreground">Combat {fight.computedOrder}</span>
                                                        </div>

                                                        <div className="flex-1 text-left">
                                                            <div className="flex items-center justify-start gap-1 font-semibold">
                                                                <span className="truncate">{p2.firstname} {p2.lastname}</span>
                                                                {fight.winner_id === p2.id && <Trophy className="h-3 w-3 text-amber-500 shrink-0" />}
                                                            </div>
                                                            <div className="text-[10px] text-muted-foreground">{p2.club} {p2.hors_categorie && "(HC)"}</div>
                                                            <div className="text-[10px] text-muted-foreground">V: {p2.victories} - P: {p2.score}</div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )
                                    })}
                                    
                                    <div className="flex justify-end pt-4 pb-2 pr-2 border-t mt-4">
                                        {(() => {
                                            const isPoolFinished = fights.length > 0 && fights.every(f => f.id !== -1 && f.winner_id !== null)
                                            
                                            if (fights.length === 0) return null

                                            if (!isPoolFinished) {
                                                return (
                                                    <div className="text-xs text-muted-foreground italic flex items-center gap-2">
                                                        <span>En cours...</span>
                                                    </div>
                                                )
                                            }

                                            return (
                                                <Badge className="bg-green-600 text-white hover:bg-green-700">
                                                    Poule Terminée
                                                </Badge>
                                            )
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Scoring Dialog */}
            <Dialog open={!!selectedFight} onOpenChange={(open) => !open && setSelectedFight(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Saisie du résultat</DialogTitle>
                    </DialogHeader>
                    {selectedFight && (
                        <form onSubmit={handleScoreSave} className="space-y-6">
                            <div className="grid grid-cols-3 gap-4 items-center text-center">
                                {/* Fighter 1 */}
                                <div className="space-y-2 flex flex-col items-center">
                                    <div className="font-bold truncate text-sm text-red-600">
                                        {(() => {
                                            const p = getParticipant(selectedFight.fighter1_id);
                                            return p ? `${p.firstname} ${p.lastname}` : "";
                                        })()}
                                    </div>
                                    <NumberInput 
                                        name="score1" 
                                        value={score1} 
                                        onChange={(val) => setScore1(Number(val))} 
                                        min={0} 
                                        inputClassName="text-center font-mono text-lg"
                                        autoFocus
                                    />
                                    <label className={cn(
                                        "flex flex-col items-center gap-1 cursor-pointer transition-opacity",
                                        !isManualAllowed && effectiveWinner !== "1" && "opacity-30 pointer-events-none"
                                    )}>
                                        <input 
                                            type="radio" 
                                            name="winner" 
                                            value="1" 
                                            checked={effectiveWinner === "1"} 
                                            onChange={() => setManualWinner("1")}
                                            disabled={!isManualAllowed}
                                            className="h-4 w-4" 
                                        />
                                        <span className="text-xs">Vainqueur</span>
                                    </label>
                                </div>

                                <div className="text-muted-foreground font-bold">VS</div>

                                {/* Fighter 2 */}
                                <div className="space-y-2 flex flex-col items-center">
                                    <div className="font-bold truncate text-sm">
                                        {(() => {
                                            const p = getParticipant(selectedFight.fighter2_id);
                                            return p ? `${p.firstname} ${p.lastname}` : "";
                                        })()}
                                    </div>
                                    <NumberInput 
                                        name="score2" 
                                        value={score2} 
                                        onChange={(val) => setScore2(Number(val))} 
                                        min={0} 
                                        inputClassName="text-center font-mono text-lg"
                                    />
                                    <label className={cn(
                                        "flex flex-col items-center gap-1 cursor-pointer transition-opacity",
                                        !isManualAllowed && effectiveWinner !== "2" && "opacity-30 pointer-events-none"
                                    )}>
                                        <input 
                                            type="radio" 
                                            name="winner" 
                                            value="2" 
                                            checked={effectiveWinner === "2"} 
                                            onChange={() => setManualWinner("2")}
                                            disabled={!isManualAllowed}
                                            className="h-4 w-4" 
                                        />
                                        <span className="text-xs">Vainqueur</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex justify-center">
                                <label className={cn(
                                    "flex items-center gap-2 cursor-pointer text-sm text-muted-foreground transition-opacity",
                                    !isManualAllowed && effectiveWinner !== "0" && "opacity-30 pointer-events-none"
                                )}>
                                    <input 
                                        type="radio" 
                                        name="winner" 
                                        value="0" 
                                        checked={effectiveWinner === "0"} 
                                        onChange={() => setManualWinner("0")}
                                        disabled={!isManualAllowed}
                                        className="h-4 w-4" 
                                    />
                                    Match nul
                                </label>
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setSelectedFight(null)}>Annuler</Button>
                                <Button type="submit">Valider</Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}