import { Participant, Fight, PoolAssignment } from "@/types"
import { getPairings } from "./pairings"

/**
 * Formats a participant's name consistently
 */
export function formatParticipantName(p: Participant | undefined) {
    if (!p) return ""
    return `${p.firstname} ${p.lastname}`
}

/**
 * Determines the status of a pool based on participants and fights
 */
export type PoolStatus = "not_started" | "in_progress" | "finished" | "validated"

export function getPoolStatus(
    poolParticipants: Participant[], 
    allFights: Fight[], 
    assignment?: PoolAssignment
): { status: PoolStatus, playedCount: number, totalFights: number } {
    
    if (assignment?.validated) {
        return { status: "validated", playedCount: 0, totalFights: 0 }
    }

    const n = poolParticipants.length
    if (n < 2) {
        return { status: "not_started", playedCount: 0, totalFights: 0 }
    }

    const pairings = getPairings(n)
    const totalFights = pairings.length
    
    // Create a set of played pairings IDs for O(1) lookup
    const playedPairings = new Set<string>()
    allFights.forEach(f => {
        // We consider a fight played if it exists in DB (0-0 are deleted)
        const id1 = Math.min(f.fighter1_id, f.fighter2_id)
        const id2 = Math.max(f.fighter1_id, f.fighter2_id)
        playedPairings.add(`${id1}-${id2}`)
    })

    const sortedP = [...poolParticipants].sort((a, b) => a.weight - b.weight)
    let playedCount = 0
    
    pairings.forEach(pair => {
        const p1 = sortedP[pair[0]-1]
        const p2 = sortedP[pair[1]-1]
        if (p1 && p2) {
            const id1 = Math.min(p1.id, p2.id)
            const id2 = Math.max(p1.id, p2.id)
            if (playedPairings.has(`${id1}-${id2}`)) {
                playedCount++
            }
        }
    })

    let status: PoolStatus = "not_started"
    if (playedCount === totalFights) status = "finished"
    else if (playedCount > 0) status = "in_progress"

    return { status, playedCount, totalFights }
}

/**
 * Sorts participants by victories then score
 */
export function sortParticipantsByRank(participants: Participant[]) {
    return [...participants].sort((a, b) => {
        const vA = a.victories ?? 0
        const vB = b.victories ?? 0
        const sA = a.score ?? 0
        const sB = b.score ?? 0
        
        if (vB !== vA) return vB - vA
        return sB - sA
    })
}
