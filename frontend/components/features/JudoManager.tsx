"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getCategories } from "@/lib/api"
import SaisieTab from "./SaisieTab"
import PouleTab from "./PouleTab"
import ScoreTab from "./ScoreTab"
import StatsTab from "./StatsTab"
import TableTab from "./TableTab"
import AdminTab from "./AdminTab"

export default function JudoManager() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlCategory = searchParams.get("category")

  const [categories, setCategories] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState("saisie")

  // Load categories on mount
  useEffect(() => {
    getCategories().then((data) => {
        setCategories(data)
    })
  }, [])

  // Redirect if no category
  useEffect(() => {
      if (categories.length > 0 && !urlCategory) {
          router.replace(`/?category=${encodeURIComponent(categories[0])}`)
      }
  }, [categories, urlCategory, router])

  const selectedCategory = (urlCategory && categories.includes(urlCategory)) 
        ? urlCategory 
        : (categories.length > 0 ? categories[0] : "")

  const handleCategoryChange = (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("category", value)
      router.push(`/?${params.toString()}`)
  }

  const handleTabChange = (value: string) => {
      setActiveTab(value)
      // Optional: Persist tab in URL too? Maybe overkill for now but easy to add.
  }

  return (
    <div className="container mx-auto p-4 max-w-5xl space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b pb-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Judo Club Montlebon</h1>
            <p className="text-muted-foreground">Gestion des inscriptions et poules</p>
        </div>
        
        {!["table", "stats", "admin"].includes(activeTab) && (
            <div className="flex items-center gap-4">
                <span className="font-medium">Catégorie:</span>
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                    <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Choisir une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                    {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                        {c}
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
            </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="saisie">Saisie</TabsTrigger>
          <TabsTrigger value="poule" disabled={!selectedCategory}>Poules</TabsTrigger>
          <TabsTrigger value="score" disabled={!selectedCategory}>Score</TabsTrigger>
          <TabsTrigger value="table">Tables</TabsTrigger>
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="admin">Admin</TabsTrigger>
        </TabsList>
        <TabsContent value="saisie" className="mt-6">
          <SaisieTab key={selectedCategory} category={selectedCategory} />
        </TabsContent>
        <TabsContent value="poule" className="mt-6">
          <PouleTab key={selectedCategory} category={selectedCategory} />
        </TabsContent>
        <TabsContent value="score" className="mt-6">
          <ScoreTab key={selectedCategory} category={selectedCategory} />
        </TabsContent>
        <TabsContent value="table" className="mt-6">
          <TableTab />
        </TabsContent>
        <TabsContent value="stats" className="mt-6">
          <StatsTab />
        </TabsContent>
        <TabsContent value="admin" className="mt-6">
            <AdminTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}