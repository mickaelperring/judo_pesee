"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { Label } from "@/components/ui/label"
import { getConfig, updateConfig, getCategories } from "@/lib/api"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Check } from "lucide-react"

export default function AdminTab() {
  const [tableCount, setTableCount] = useState<string>("5")
  const [categories, setCategories] = useState<string[]>([])
  const [activeCategories, setActiveCategories] = useState<string[]>([])
  
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle")
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Load config and categories
    Promise.all([
        getConfig("table_count"),
        getConfig("active_categories"),
        getCategories()
    ]).then(([confTables, confActive, allCats]) => {
        if (confTables.value) setTableCount(confTables.value)
        if (confActive.value) setActiveCategories(confActive.value.split(","))
        setCategories(allCats)
        isFirstRender.current = false
    })
  }, [])

  useEffect(() => {
      if (isFirstRender.current) return

      setStatus("saving")
      const timer = setTimeout(async () => {
          try {
              await updateConfig("table_count", tableCount)
              await updateConfig("active_categories", activeCategories.join(","))
              setStatus("saved")
              setTimeout(() => setStatus("idle"), 2000)
          } catch {
              setStatus("idle")
              toast.error("Erreur de sauvegarde")
          }
      }, 800) // Debounce 800ms

      return () => clearTimeout(timer)
  }, [tableCount, activeCategories])

  const toggleCategory = (cat: string) => {
      setActiveCategories(prev => 
          prev.includes(cat) 
            ? prev.filter(c => c !== cat)
            : [...prev, cat]
      )
  }

  return (
    <div className="py-4 max-w-lg mx-auto">
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Configuration Admin</CardTitle>
                    <div className="text-sm text-muted-foreground flex items-center gap-2 h-6">
                        {status === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> Enregistrement...</>}
                        {status === "saved" && <><Check className="h-3 w-3 text-green-500" /> Enregistré</>}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="tables">Nombre de Tables (Tatamis)</Label>
                    <NumberInput 
                        id="tables" 
                        min="1" 
                        max="20"
                        value={tableCount} 
                        onChange={setTableCount} 
                    />
                    <p className="text-sm text-muted-foreground">
                        Définit le nombre de colonnes dans l&apos;onglet &quot;Tables&quot;.
                    </p>
                </div>

                <div className="space-y-3">
                    <Label>Catégories en cours (pour répartition Tables)</Label>
                    <div className="grid grid-cols-2 gap-2 border rounded-lg p-4 max-h-60 overflow-y-auto">
                        {categories.map(cat => (
                            <div key={cat} className="flex items-center space-x-2">
                                <input 
                                    type="checkbox" 
                                    id={`cat-${cat}`}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={activeCategories.includes(cat)}
                                    onChange={() => toggleCategory(cat)}
                                />
                                <Label htmlFor={`cat-${cat}`} className="font-normal cursor-pointer">
                                    {cat}
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
  )
}