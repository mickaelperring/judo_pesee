"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { getParticipants, getPoolAssignments, getFights, createFights, updateFight, getConfig } from "@/lib/api"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { getPairings } from "@/lib/pairings"
import { Participant, Fight, PoolAssignment } from "@/types"
import { Loader2, Trophy, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface TableMatchViewProps {
    tableId: string
}

export default function TableMatchView({ tableId }: TableMatchViewProps) {
    const [loading, setLoading] = useState(true)
    const [pools, setPools] = useState<PoolAssignment[]>([])
    const [participants, setParticipants] = useState<Participant[]>([])
    const [fights, setFights] = useState<Fight[]>([])
    const [activePool, setActivePool] = useState<string | null>(null) // "cat-poolNum"
    const [selectedFight, setSelectedFight] = useState<Fight | null>(null)
    const [score1, setScore1] = useState(0)
    const [score2, setScore2] = useState(0)

    // Derived: Active Categories
    const [activeCategories, setActiveCategories] = useState<string[]>([])

    // ... (loadData omitted)

    // ... (loadActivePoolFights omitted)

    // Reload fights for active pool
    const loadActivePoolFights = async (category: string, poolNumber: number) => {
        const poolFights = await getFights(category, poolNumber)
        
        // Check if generated
        if (poolFights.length === 0) {
            // Generate
            const poolParticipants = participants.filter(p => p.category === category && p.pool_number === poolNumber)
            // Sort by ID or weight or name? 
            // "Chaque participant est numéroté dans sa poule (identifiant croissant)" -> implicitly sorted by ID usually or arbitrary 1..N
            // Let's sort by Weight (standard) then ID?
            // Actually, usually pools are ordered by weight.
            poolParticipants.sort((a, b) => a.weight - b.weight)
            
            const n = poolParticipants.length
            const pairings = getPairings(n)
            
            if (pairings.length > 0) {
                const newFightsData = pairings.map((pair, idx) => {
                    const p1 = poolParticipants[pair[0] - 1]
                    const p2 = poolParticipants[pair[1] - 1]
                    return {
                        category,
                        pool_number: poolNumber,
                        order: idx + 1,
                        fighter1_id: p1.id,
                        fighter2_id: p2.id,
                        score1: 0,
                        score2: 0,
                        winner_id: null
                    }
                })
                
                const created = await createFights(newFightsData)
                setFights(created)
            } else {
                setFights([])
            }
        } else {
            setFights(poolFights)
        }
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
        setSelectedFight(f)
    }

    const handleScoreSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedFight) return
        
        // Read form data (using refs or controlled? uncontrolled for simplicity in modal)
        const form = e.target as HTMLFormElement
        // s1 and s2 from state
        
        // Winner is radio or logic? 
        // "pouvoir désigner la victoire".
        // Often winner is highest score, BUT in Judo ippon wins regardless. 
        // So explicit winner selection is best.
        const winnerVal = (form.elements.namedItem("winner") as RadioNodeList).value
        
        const winnerId = winnerVal === "1" ? selectedFight.fighter1_id : winnerVal === "2" ? selectedFight.fighter2_id : null

        try {
            await updateFight(selectedFight.id, {
                score1: score1,
                score2: score2,
                winner_id: winnerId
            })
            toast.success("Combat enregistré")
            setSelectedFight(null)
            
            // Reload fights AND participants (for stats)
            // Getting parts of key from activePool is tricky if not passed.
            // But we know the active pool.
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
                    
                    return (
                        <div key={pool.id} className="space-y-2">
                            {/* Pool Card */}
                            <Card 
                                className={cn("cursor-pointer transition-colors border-l-4 border-l-primary", isActive ? "bg-muted/50" : "hover:bg-muted/20")}
                                onClick={() => handlePoolClick(pool)}
                            >
                                <CardHeader className="p-4">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-base">{pool.category} - Poule {pool.pool_number}</CardTitle>
                                        <Badge variant="secondary">{poolParticipants.length} combattants</Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {poolParticipants.map(p => p.lastname).join(", ")}
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

                                        const isDone = fight.winner_id !== null
                                        
                                        return (
                                            <Card key={fight.id} className="cursor-pointer hover:bg-accent" onClick={() => handleFightClick(fight)}>
                                                <CardContent className="p-3">
                                                    <div className="flex items-center justify-between gap-2 text-sm">
                                                        <div className={cn("flex-1 text-right", fight.winner_id === p1.id && "font-bold text-green-600")}>
                                                            <div className="truncate">{p1.lastname} {p1.firstname}</div>
                                                            <div className="text-[10px] text-muted-foreground">{p1.club} {p1.hors_categorie && "(HC)"}</div>
                                                            <div className="text-[10px] text-muted-foreground">V: {p1.victories} - P: {p1.score}</div>
                                                        </div>
                                                        
                                                        <div className="flex flex-col items-center px-2 bg-muted/30 rounded">
                                                            <span className="font-mono font-bold text-lg">{fight.score1} - {fight.score2}</span>
                                                            <span className="text-[10px] text-muted-foreground">Combat {fight.order}</span>
                                                        </div>

                                                        <div className={cn("flex-1 text-left", fight.winner_id === p2.id && "font-bold text-green-600")}>
                                                            <div className="truncate">{p2.lastname} {p2.firstname}</div>
                                                            <div className="text-[10px] text-muted-foreground">{p2.club} {p2.hors_categorie && "(HC)"}</div>
                                                            <div className="text-[10px] text-muted-foreground">V: {p2.victories} - P: {p2.score}</div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )
                                    })}
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
                                <div className="space-y-2">
                                    <div className="font-bold truncate text-sm">
                                        {getParticipant(selectedFight.fighter1_id)?.lastname}
                                    </div>
                                    <NumberInput 
                                        name="score1" 
                                        value={score1} 
                                        onChange={(val) => setScore1(Number(val))} 
                                        min={0} 
                                        inputClassName="text-center font-mono text-lg"
                                        autoFocus
                                    />
                                    <label className="flex flex-col items-center gap-1 cursor-pointer">
                                        <input type="radio" name="winner" value="1" defaultChecked={selectedFight.winner_id === selectedFight.fighter1_id} className="h-4 w-4" />
                                        <span className="text-xs">Vainqueur</span>
                                    </label>
                                </div>

                                <div className="text-muted-foreground font-bold">VS</div>

                                {/* Fighter 2 */}
                                <div className="space-y-2">
                                    <div className="font-bold truncate text-sm">
                                        {getParticipant(selectedFight.fighter2_id)?.lastname}
                                    </div>
                                    <NumberInput 
                                        name="score2" 
                                        value={score2} 
                                        onChange={(val) => setScore2(Number(val))} 
                                        min={0} 
                                        inputClassName="text-center font-mono text-lg"
                                    />
                                    <label className="flex flex-col items-center gap-1 cursor-pointer">
                                        <input type="radio" name="winner" value="2" defaultChecked={selectedFight.winner_id === selectedFight.fighter2_id} className="h-4 w-4" />
                                        <span className="text-xs">Vainqueur</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex justify-center">
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground">
                                    <input type="radio" name="winner" value="0" defaultChecked={!selectedFight.winner_id} className="h-4 w-4" />
                                    Match nul / En cours
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
