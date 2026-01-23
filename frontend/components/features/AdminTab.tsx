"use client"

import { useState, useEffect, useRef } from "react"

import { Input } from "@/components/ui/input"

import { Label } from "@/components/ui/label"

import { Button } from "@/components/ui/button"

import { getConfig, updateConfig, getCategoriesFull, createCategory, updateCategory, deleteCategory } from "@/lib/api"

import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { Loader2, Check, Plus, Trash2, Edit2, Save, X } from "lucide-react"

import { cn } from "@/lib/utils"



interface Category {



    id: number



    name: string



    include_in_stats: boolean



}







export default function AdminTab() {

  const [tableCount, setTableCount] = useState<string>("5")

  const [categories, setCategories] = useState<Category[]>([])

  const [activeCategories, setActiveCategories] = useState<string[]>([])

  

  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle")

  const isFirstRender = useRef(true)



  // Category management state

  const [newCatName, setNewCatName] = useState("")

  const [editingId, setEditingId] = useState<number | null>(null)

  const [editingName, setEditingName] = useState("")



  const loadData = async () => {

    try {

        const [confTables, confActive, allCats] = await Promise.all([

            getConfig("table_count"),

            getConfig("active_categories"),

            getCategoriesFull()

        ])

        if (confTables.value) setTableCount(confTables.value)

        if (confActive.value) setActiveCategories(confActive.value.split(","))

        setCategories(allCats)

    } catch {

        toast.error("Erreur de chargement")

    }

  }



  useEffect(() => {

    loadData().finally(() => {

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



  const toggleActiveCategory = (catName: string) => {

      setActiveCategories(prev => 

          prev.includes(catName) 

            ? prev.filter(c => c !== catName)

            : [...prev, catName]

      )

  }



  const handleAddCategory = async () => {

      if (!newCatName.trim()) return

      try {

          await createCategory({ name: newCatName.trim(), include_in_stats: true })

          setNewCatName("")

          toast.success("Catégorie ajoutée")

          loadData()

      } catch {

          toast.error("Erreur lors de l'ajout")

      }

  }



  const handleDeleteCategory = async (id: number) => {

      if (!confirm("Voulez-vous vraiment supprimer cette catégorie ?")) return

      try {

          await deleteCategory(id)

          toast.success("Catégorie supprimée")

          loadData()

      } catch {

          toast.error("Erreur lors de la suppression")

      }

  }



  const handleToggleStats = async (id: number, val: boolean) => {

      try {

          await updateCategory(id, { include_in_stats: val })

          setCategories(prev => prev.map(c => c.id === id ? { ...c, include_in_stats: val } : c))

          toast.success("Statistiques mises à jour")

      } catch {

          toast.error("Erreur de mise à jour")

      }

  }



  const startEditing = (cat: Category) => {

      setEditingId(cat.id)

      setEditingName(cat.name)

  }



  const saveEdit = async () => {

      if (!editingId || !editingName.trim()) return

      try {

          await updateCategory(editingId, { name: editingName.trim() })

          setEditingId(null)

          toast.success("Catégorie modifiée")

          loadData()

      } catch {

          toast.error("Erreur lors de la modification")

      }

  }



  return (

    <div className="py-4 space-y-8 max-w-2xl mx-auto">

        {/* Configuration Générale */}

        <Card>

            <CardHeader>

                <div className="flex justify-between items-center">

                    <CardTitle className="text-lg">Configuration Générale</CardTitle>

                    <div className="text-[10px] text-muted-foreground flex items-center gap-2 h-6 uppercase font-black tracking-widest">

                        {status === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> Enregistrement...</>}

                        {status === "saved" && <><Check className="h-3 w-3 text-green-500" /> Enregistré</>}

                    </div>

                </div>

            </CardHeader>

            <CardContent className="space-y-6 text-sm">

                <div className="space-y-2">

                    <Label htmlFor="tables">Nombre de Tables (Tatamis)</Label>

                    <Input 

                        id="tables" 

                        type="number" 

                        min="1" 

                        max="20"

                        value={tableCount} 

                        onChange={(e) => setTableCount(e.target.value)} 

                    />

                </div>



                <div className="space-y-3">

                    <Label>Catégories actives (en cours de combat)</Label>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border rounded-xl p-4 bg-slate-50/50">

                        {categories.map(cat => (

                            <label key={cat.id} className="flex items-center space-x-2 cursor-pointer group">

                                <input 

                                    type="checkbox" 

                                    className="h-4 w-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500"

                                    checked={activeCategories.includes(cat.name)}

                                    onChange={() => toggleActiveCategory(cat.name)}

                                />

                                <span className="text-xs group-hover:text-indigo-600 transition-colors">

                                    {cat.name}

                                </span>

                            </label>

                        ))}

                    </div>

                </div>

            </CardContent>

        </Card>



        {/* Gestion des Catégories */}

        <Card>

            <CardHeader>

                <CardTitle className="text-lg">Gestion des Catégories</CardTitle>

            </CardHeader>

            <CardContent className="space-y-6">

                {/* Add Category */}

                <div className="flex gap-2">

                    <Input 

                        placeholder="Nouvelle catégorie..." 

                        value={newCatName}

                        onChange={(e) => setNewCatName(e.target.value)}

                        onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}

                    />

                    <Button onClick={handleAddCategory}>

                        <Plus className="h-4 w-4 mr-2" /> Ajouter

                    </Button>

                </div>



                <div className="border rounded-xl overflow-hidden">

                    <table className="w-full text-sm">

                        <thead className="bg-slate-50 border-b">

                            <tr>

                                <th className="text-left p-3 font-black uppercase text-[10px] tracking-widest text-slate-500">Nom</th>

                                <th className="text-center p-3 font-black uppercase text-[10px] tracking-widest text-slate-500">Stats</th>

                                <th className="text-right p-3 font-black uppercase text-[10px] tracking-widest text-slate-500">Actions</th>

                            </tr>

                        </thead>

                        <tbody className="divide-y">

                            {categories.map(cat => (

                                <tr key={cat.id} className="hover:bg-slate-50/50">

                                    <td className="p-3">

                                        {editingId === cat.id ? (

                                            <Input 

                                                value={editingName} 

                                                onChange={(e) => setEditingName(e.target.value)}

                                                className="h-8 text-sm"

                                                autoFocus

                                            />

                                        ) : (

                                            <span className="font-medium">{cat.name}</span>

                                        )}

                                    </td>

                                    <td className="p-3 text-center">

                                        <input 

                                            type="checkbox"

                                            checked={cat.include_in_stats}

                                            onChange={(e) => handleToggleStats(cat.id, e.target.checked)}

                                            className="h-4 w-4 rounded-md accent-indigo-600"

                                            title="Inclure dans les statistiques globales"

                                        />

                                    </td>

                                    <td className="p-3 text-right">

                                        <div className="flex justify-end gap-1">

                                            {editingId === cat.id ? (

                                                <>

                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={saveEdit}>

                                                        <Save className="h-4 w-4" />

                                                    </Button>

                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={() => setEditingId(null)}>

                                                        <X className="h-4 w-4" />

                                                    </Button>

                                                </>

                                            ) : (

                                                <>

                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={() => startEditing(cat)}>

                                                        <Edit2 className="h-4 w-4" />

                                                    </Button>

                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-400" onClick={() => handleDeleteCategory(cat.id)}>

                                                        <Trash2 className="h-4 w-4" />

                                                    </Button>

                                                </>

                                            )}

                                        </div>

                                    </td>

                                </tr>

                            ))}

                        </tbody>

                    </table>

                </div>

            </CardContent>

        </Card>

    </div>

  )

}
