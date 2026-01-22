"use client"

import { useState, useEffect, useRef } from "react"
import { getChronoConfig } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Play, Pause, RotateCcw, Plus, Square } from "lucide-react"
import { toast } from "sonner"
import confetti from "canvas-confetti"

interface ChronoConfig {
    match_time: number
    osaekomi_time: number
}

export default function ChronoPage() {
    const [config, setConfig] = useState<Record<string, ChronoConfig>>({})
    const [category, setCategory] = useState<string>("")
    
    // Main Timer
    const [timeElapsed, setTimeElapsed] = useState(0) // seconds
    const [isRunning, setIsRunning] = useState(false)
    const [isFinished, setIsFinished] = useState(false)
    const [isGoldenScore, setIsGoldenScore] = useState(false)
    
    // Osaekomi Timer
    const [osaekomiTime, setOsaekomiTime] = useState(0) // seconds
    const [isOsaekomiRunning, setIsOsaekomiRunning] = useState(false)
    const [osaekomiResult, setOsaekomiResult] = useState<string | null>(null)
    const [showIpponAnimation, setShowIpponAnimation] = useState(false)

    const mainTimerRef = useRef<NodeJS.Timeout | null>(null)
    const osaekomiTimerRef = useRef<NodeJS.Timeout | null>(null)
    const osaekomiTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Load config
    useEffect(() => {
        getChronoConfig()
            .then(data => {
                setConfig(data)
                initializeCategory(data)
            })
            .catch(err => {
                console.error("Failed to load chrono config", err)
                const fallback: Record<string, ChronoConfig> = {
                    "Minimes": { match_time: 180, osaekomi_time: 20 },
                    "Benjamins": { match_time: 180, osaekomi_time: 20 },
                    "Poussins": { match_time: 150, osaekomi_time: 20 },
                    "Mini-Poussins": { match_time: 120, osaekomi_time: 15 },
                    "Moustiques": { match_time: 90, osaekomi_time: 15 }
                }
                setConfig(fallback)
                initializeCategory(fallback)
            })
    }, [])

    const initializeCategory = (data: Record<string, ChronoConfig>) => {
        const savedCat = localStorage.getItem("chrono_category")
        if (savedCat && data[savedCat]) {
            setCategory(savedCat)
            setTimeElapsed(0)
        } else if (Object.keys(data).length > 0) {
            const first = Object.keys(data)[0]
            setCategory(first)
            setTimeElapsed(0)
        }
    }

    const handleCategoryChange = (val: string) => {
        setCategory(val)
        localStorage.setItem("chrono_category", val)
        if (config[val]) {
            resetAll()
        }
    }

    const resetAll = () => {
        setIsRunning(false)
        setIsFinished(false)
        setIsGoldenScore(false)
        setTimeElapsed(0)
        
        stopOsaekomi()
        setOsaekomiTime(0)
        setOsaekomiResult(null)
        
        if (mainTimerRef.current) clearInterval(mainTimerRef.current)
    }

    // Main Timer Logic
    const matchLimit = config[category]?.match_time || 180
    
    useEffect(() => {
        if (isRunning && !isFinished) {
            mainTimerRef.current = setInterval(() => {
                setTimeElapsed(prev => {
                    const next = prev + 1
                    
                    if (isGoldenScore) {
                        if (next >= 60) {
                            setIsRunning(false)
                            setIsFinished(true)
                            return 60
                        }
                    } else if (next >= matchLimit) {
                        setIsRunning(false)
                        setIsFinished(true)
                        return matchLimit
                    }
                    return next
                })
            }, 1000)
        } else {
            if (mainTimerRef.current) clearInterval(mainTimerRef.current)
        }
        return () => { if (mainTimerRef.current) clearInterval(mainTimerRef.current) }
    }, [isRunning, isFinished, isGoldenScore, matchLimit])

    // Osaekomi Timer Logic
    const osaekomiLimit = config[category]?.osaekomi_time || 20

    useEffect(() => {
        if (isOsaekomiRunning) {
            osaekomiTimerRef.current = setInterval(() => {
                setOsaekomiTime(prev => {
                    const next = prev + 1
                    
                    if (next >= osaekomiLimit) {
                        setOsaekomiResult("IPPON")
                        setShowIpponAnimation(true)
                        setIsOsaekomiRunning(false)
                        
                        // Fireworks effect
                        const duration = 4 * 1000
                        const animationEnd = Date.now() + duration
                        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 200 }

                        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min

                        const interval: any = setInterval(function() {
                            const timeLeft = animationEnd - Date.now()

                            if (timeLeft <= 0) {
                                return clearInterval(interval)
                            }

                            const particleCount = 50 * (timeLeft / duration)
                            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } })
                            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } })
                        }, 250)

                        setTimeout(() => setShowIpponAnimation(false), 4000)
                        return next
                    } else if (next >= 10) {
                        setOsaekomiResult("WAZA-ARI")
                    } else if (next >= 5) {
                        setOsaekomiResult("YUKO")
                    }
                    
                    return next
                })
            }, 1000)
        } else {
            if (osaekomiTimerRef.current) {
                clearInterval(osaekomiTimerRef.current)
                osaekomiTimerRef.current = null
            }
            if (osaekomiTime > 0 || osaekomiResult) {
                if (osaekomiTimeoutRef.current) clearTimeout(osaekomiTimeoutRef.current)
                osaekomiTimeoutRef.current = setTimeout(() => {
                    setOsaekomiTime(0)
                    setOsaekomiResult(null)
                }, 3000)
            }
        }
        return () => { 
            if (osaekomiTimerRef.current) clearInterval(osaekomiTimerRef.current)
        }
    }, [isOsaekomiRunning, osaekomiLimit])

    const stopOsaekomi = () => {
        setIsOsaekomiRunning(false)
        if (osaekomiTimerRef.current) {
            clearInterval(osaekomiTimerRef.current)
            osaekomiTimerRef.current = null
        }
    }

    const handleStartStop = () => {
        if (isRunning) {
            if (confirm("Mettre le combat en pause ?")) {
                setIsRunning(false)
            }
        } else {
            setIsRunning(true)
        }
    }
    const handleReset = () => {
        if (isFinished || confirm("Réinitialiser le combat ?")) {
            resetAll()
        }
    }
    
    const handleGoldenScore = () => {
        if (isFinished) {
            setTimeElapsed(0)
            setIsFinished(false)
            setIsGoldenScore(true)
            setIsRunning(true)
        }
    }

    const handleOsaekomi = () => {
        if (isOsaekomiRunning) {
            stopOsaekomi()
        } else {
            if (!isRunning) {
                toast.error("Lancez d'abord le chrono du match")
                return
            }
            if (osaekomiTimeoutRef.current) clearTimeout(osaekomiTimeoutRef.current)
            setOsaekomiTime(0)
            setOsaekomiResult(null)
            setIsOsaekomiRunning(true)
        }
    }

    const formatTime = (s: number) => {
        const mins = Math.floor(s / 60)
        const secs = s % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    return (
        <div className="h-[100dvh] w-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 flex flex-col p-1 pb-[100px] sm:p-4 overflow-hidden fixed inset-0 overscroll-none touch-none font-sans">
            {/* Header: Category Selector */}
            <div className="flex justify-between items-center h-[6vh] px-2 shrink-0">
                <div className="flex items-center gap-2">
                    <Select value={category} onValueChange={handleCategoryChange}>
                        <SelectTrigger className="w-[110px] sm:w-[200px] bg-slate-900/80 border-slate-800 text-slate-200 text-[10px] sm:text-lg h-7 sm:h-10 rounded-lg shadow-sm backdrop-blur-md">
                            <SelectValue placeholder="Catégorie" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 text-slate-200 border-slate-800">
                            {Object.keys(config).map(cat => (
                                <SelectItem key={cat} value={cat} className="text-base sm:text-lg focus:bg-indigo-600 focus:text-white cursor-pointer">
                                    {cat}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {isGoldenScore && (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/20 text-[10px] sm:text-sm px-2 py-0.5 animate-pulse uppercase font-black border-none">GOLDEN SCORE</Badge>
                    )}
                </div>
                
                <Button 
                    variant="destructive" 
                    onClick={handleReset} 
                    size="default" 
                    className="h-10 sm:h-12 bg-rose-600 hover:bg-rose-500 text-white border-none rounded-xl shadow-lg transition-all active:scale-95 px-4 sm:px-6 font-black"
                >
                    <RotateCcw className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> RESET
                </Button>
            </div>

            {/* Main Timer Area */}
            <div className="flex-1 flex flex-col justify-center items-center relative min-h-0 w-full px-1">
                {/* Circular Gauge - Smaller and Above */}
                {!isFinished && (
                    <div className="flex items-center justify-center pointer-events-none opacity-40 mb-2">
                        <svg className="w-12 h-12 sm:w-16 sm:h-16 -rotate-90">
                            <circle
                                cx="50%"
                                cy="50%"
                                r="40%"
                                className="stroke-slate-900 fill-none"
                                strokeWidth="6"
                            />
                            <circle
                                cx="50%"
                                cy="50%"
                                r="40%"
                                className={cn(
                                    "fill-none transition-all duration-1000 ease-linear",
                                    isGoldenScore ? "stroke-amber-500" : "stroke-indigo-500"
                                )}
                                strokeWidth="6"
                                strokeDasharray="251%" /* 2 * pi * 40 */
                                style={{ 
                                    strokeDashoffset: `${251 - (Math.min(100, (timeElapsed / (isGoldenScore ? 60 : matchLimit)) * 100) * 2.51)}%` 
                                }}
                                strokeLinecap="round"
                            />
                        </svg>
                    </div>
                )}

                {isGoldenScore && (
                    <div className="absolute top-0 text-amber-500/80 text-xs sm:text-xl font-black tracking-[0.3em] uppercase mb-2">
                        GOLDEN SCORE
                    </div>
                )}
                
                <button 
                    className={cn(
                        "relative flex flex-col items-center justify-center w-full max-w-none sm:max-w-4xl py-2 sm:py-12 rounded-[1.5rem] sm:rounded-[3rem] transition-all duration-75 active:scale-95 active:translate-y-1 touch-manipulation border-b-4 sm:border-b-[12px] shadow-xl",
                        isFinished 
                            ? "bg-rose-950/20 border-rose-900 text-rose-500 animate-pulse" 
                            : isRunning 
                                ? "bg-gradient-to-b from-slate-900/40 to-slate-950/80 border-slate-800 text-slate-100 active:border-b-0" 
                                : "bg-amber-500/5 border-amber-600/50 text-amber-400 active:border-b-0"
                    )}
                    onClick={handleStartStop}
                >
                    <div className={cn(
                        "text-[10px] sm:text-sm uppercase font-black tracking-widest mb-2 opacity-80",
                        isRunning ? "text-emerald-500" : "text-amber-500"
                    )}>
                        {isFinished ? "FIN DU MATCH" : isRunning ? "• Combat en cours" : timeElapsed === 0 ? "Appuyer pour démarrer" : "Match en pause"}
                    </div>
                    <div className={cn(
                        "text-[22vw] sm:text-[20vw] font-black font-mono leading-none tabular-nums select-none transition-all duration-500",
                        isFinished ? "drop-shadow-[0_0_35px_rgba(244,63,94,0.8)]" : isRunning ? "drop-shadow-[0_0_25px_rgba(255,255,255,0.4)]" : "drop-shadow-[0_0_25px_rgba(251,191,36,0.5)]"
                    )}>
                        {formatTime(timeElapsed)}
                    </div>
                    
                    {!isFinished && (
                        <div className={cn(
                            "absolute right-2 sm:right-12 transition-all duration-300",
                            isRunning ? "text-slate-700 opacity-30" : "text-amber-500 opacity-70 scale-110"
                        )}>
                            {isRunning ? <Pause className="h-6 w-6 sm:h-16 sm:w-16 fill-current" /> : <Play className="h-8 w-8 sm:h-16 sm:w-16 fill-current" />}
                        </div>
                    )}
                </button>

                <div className="text-[10px] sm:text-base font-medium text-slate-600 tracking-widest uppercase mt-1 sm:mt-6 select-none opacity-100">
                    Temps total : {formatTime(isGoldenScore ? 60 : matchLimit)}
                </div>
                
                {isFinished && (
                    <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-500 z-20 rounded-2xl">
                        <div className="text-xl sm:text-5xl font-black text-rose-500 mb-4 uppercase tracking-widest drop-shadow-lg text-center">FIN DU TEMPS</div>
                        <Button 
                            className="bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 text-sm sm:text-2xl h-10 sm:h-20 px-6 sm:px-12 rounded-xl shadow-[0_10px_40px_rgba(245,158,11,0.3)] active:translate-y-1 transition-all font-black" 
                            onClick={handleGoldenScore}
                        >
                            <Play className="mr-2 h-4 w-4 sm:h-8 sm:w-8 fill-current" /> DÉMARRER GOLDEN SCORE
                        </Button>
                    </div>
                )}
            </div>

            {/* Bottom: Osaekomi & Controls */}
            <div className="h-[22vh] sm:h-[32vh] grid grid-cols-2 gap-2 sm:gap-6 mb-1 shrink-0">
                <Button 
                    className={cn(
                        "h-full text-base sm:text-3xl font-black flex flex-col items-center justify-center transition-all duration-150 rounded-xl sm:rounded-[2.5rem] shadow-xl border-b-8 active:border-b-0 active:translate-y-1 touch-manipulation",
                        isOsaekomiRunning 
                            ? "bg-gradient-to-b from-rose-500 to-rose-700 border-rose-900 text-white" 
                            : "bg-gradient-to-b from-indigo-500 to-indigo-700 border-indigo-900 text-white"
                    )}
                    onClick={handleOsaekomi}
                >
                    <div className="flex items-center gap-2 mb-0.5 sm:mb-1 uppercase opacity-95 text-xs sm:text-3xl">
                        {isOsaekomiRunning ? (
                            <><span>TOKETA</span><Square className="h-4 w-4 sm:h-8 sm:w-8 fill-current" /></>
                        ) : (
                            <><span>OSAEKOMI</span><Play className="h-4 w-4 sm:h-8 sm:w-8 fill-current" /></>
                        )}
                    </div>
                    <div className="text-[10vw] sm:text-[10vw] font-mono leading-none drop-shadow-md">{osaekomiTime}s</div>
                </Button>

                <div className="bg-black/40 rounded-xl sm:rounded-[2.5rem] border-2 border-slate-900 flex items-center justify-center shadow-[inset_0_4px_20px_rgba(0,0,0,0.8)] overflow-hidden relative">
                    {osaekomiResult ? (
                        <div className="flex flex-col items-center">
                            <div className="text-[8px] sm:text-xs text-amber-500/60 uppercase font-black tracking-widest mb-2 animate-pulse">IMMOBILISATION</div>
                            <div className="text-[10vw] sm:text-[8vw] font-black text-amber-400 animate-bounce text-center leading-none drop-shadow-[0_0_20px_rgba(251,191,36,0.4)]">
                                {osaekomiResult}
                            </div>
                        </div>
                    ) : !isOsaekomiRunning ? (
                        <div className="text-center opacity-70">
                            <div className="text-slate-500 text-[8px] sm:text-xs uppercase font-black tracking-[0.2em] mb-0.5">TEMPS RESTANT</div>
                            <div className="text-slate-200 text-xl sm:text-5xl font-mono font-bold tracking-tighter">
                                {formatTime(Math.max(0, (isGoldenScore ? 60 : matchLimit) - timeElapsed))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className="text-[8px] sm:text-xs text-indigo-400 uppercase font-black tracking-[0.2em] mb-2 animate-pulse">IMMO. EN COURS</div>
                            <div className="absolute inset-0 bg-indigo-500/10 animate-pulse" />
                        </div>
                    )}
                </div>
            </div>

            {/* IPPON Victory Overlay */}
            {showIpponAnimation && (
                <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-500/20 via-transparent to-blue-500/20 animate-pulse" />
                    <div className="relative">
                        <div className="absolute inset-0 blur-3xl bg-blue-500/40 animate-pulse scale-150" />
                        <h1 className="text-[30vw] font-black italic tracking-tighter text-blue-400 drop-shadow-[0_0_50px_rgba(59,130,246,0.8)] animate-in zoom-in-50 spin-in-1 duration-500">
                            IPPON
                        </h1>
                    </div>
                    <div className="mt-8 text-4xl font-black text-white tracking-[1em] uppercase opacity-50 animate-pulse">
                        Victoire
                    </div>
                </div>
            )}
        </div>
    )
}
