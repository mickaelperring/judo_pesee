"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getParticipants, createParticipant, updateParticipant, deleteParticipant, getClubs, getPreregistrations } from "@/lib/api"
import { toast } from "sonner"
import { Participant, ParticipantCreate } from "@/types"
import { cn } from "@/lib/utils"
import { Trash2 } from "lucide-react"

interface SaisieTabProps {
  category: string
}

export default function SaisieTab({ category }: SaisieTabProps) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [clubs, setClubs] = useState<string[]>([])
  const [preregistrations, setPreregistrations] = useState<ParticipantCreate[]>([])

  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      const lastCompare = a.lastname.localeCompare(b.lastname)
      if (lastCompare !== 0) return lastCompare
      return a.firstname.localeCompare(b.firstname)
    })
  }, [participants])

  // Form State
  const [editingId, setEditingId] = useState<number | null>(null)
  const [firstname, setFirstname] = useState("")
  const [lastname, setLastname] = useState("")
  const [sex, setSex] = useState<"M" | "F">("M")
  const [birthYear, setBirthYear] = useState<string>("2015")
  const [weight, setWeight] = useState("")
  const [club, setClub] = useState("")

  // Suggestion Visibility & Selection
  const [showNameSuggestions, setShowNameSuggestions] = useState(false)
  const [nameSelectedIndex, setNameSelectedIndex] = useState(-1)
  const [showClubSuggestions, setShowClubSuggestions] = useState(false)
  const [clubSelectedIndex, setClubSelectedIndex] = useState(-1)
  
  // Highlight animation
  const [highlightedId, setHighlightedId] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    try {
      const data = await getParticipants(category)
      setParticipants(data)
    } catch {
      toast.error("Erreur lors du chargement des participants")
    }
  }, [category])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setFirstname("")
    setLastname("")
    setWeight("")
    // setClub("") // Optional: keep club for workflow
  }, [])

  useEffect(() => {
    if (category) {
      // eslint-disable-next-line
      loadData()
      // handleCancelEdit() is handled by key prop remounting
    }
  }, [category, loadData])

  useEffect(() => {
    // Load global data
    getClubs().then(setClubs)
    getPreregistrations().then(setPreregistrations)
  }, [])

  const handlePreregistrationSelect = (pre: ParticipantCreate) => {
    setFirstname(pre.firstname)
    setLastname(pre.lastname)
    setSex(pre.sex as "M" | "F")
    setBirthYear(pre.birth_year.toString())
    setClub(pre.club)
    setWeight(pre.weight.toString())
    setShowNameSuggestions(false)
    setNameSelectedIndex(-1)
  }

  const handleEditSelect = (p: Participant) => {
    setEditingId(p.id)
    setFirstname(p.firstname)
    setLastname(p.lastname)
    setSex(p.sex as "M" | "F")
    setBirthYear(p.birth_year.toString())
    setClub(p.club)
    setWeight(p.weight.toString())
    toast.info("Mode modification activé")
  }

  const handleDelete = async () => {
      if (!editingId) return
      if (!confirm("Voulez-vous vraiment supprimer ce participant ?")) return
      
      try {
          await deleteParticipant(editingId)
          toast.success("Participant supprimé")
          loadData()
          handleCancelEdit()
          getClubs().then(setClubs)
      } catch {
          toast.error("Erreur lors de la suppression")
      }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category) return toast.error("Veuillez sélectionner une catégorie")

    // Uniqueness check (skip if editing same participant, or logic gets complex)
    // If Creating: check all.
    // If Editing: check all EXCEPT self.
    const isDuplicate = participants.some(p => 
      p.id !== editingId && // Ignore self if editing
      p.lastname.toLowerCase().trim() === lastname.toLowerCase().trim() && 
      p.firstname.toLowerCase().trim() === firstname.toLowerCase().trim() &&
      p.club.toLowerCase().trim() === club.toLowerCase().trim()
    )

    if (isDuplicate) {
      return toast.error("Participant déjà inscrit (Nom/Prénom/Club identiques)")
    }
    
    try {
      const baseData = {
        category,
        firstname,
        lastname,
        sex,
        birth_year: parseInt(birthYear),
        club,
        weight: parseFloat(weight),
      }

      if (editingId) {
          await updateParticipant(editingId, baseData)
          toast.success("Participant modifié")
          setHighlightedId(editingId)
          setTimeout(() => setHighlightedId(null), 2000)
          setEditingId(null)
      } else {
          await createParticipant(baseData as ParticipantCreate)
          toast.success("Participant ajouté")
      }
      
      loadData()
      // Refresh clubs list in case a new club was added
      getClubs().then(setClubs)
      
      setFirstname("")
      setLastname("")
      setWeight("")
    } catch {
      toast.error("Erreur lors de l'enregistrement")
    }
  }

  if (!category) {
    return <div className="p-8 text-center text-muted-foreground">Veuillez sélectionner une catégorie ci-dessus.</div>
  }

  const filteredPreregistrations = preregistrations.filter(p => 
    p.category === category && 
    (lastname.length > 0 || firstname.length > 0) &&
    (p.lastname.toLowerCase().includes(lastname.toLowerCase()) && 
     p.firstname.toLowerCase().includes(firstname.toLowerCase()))
  )

  const filteredClubs = clubs.filter(c => 
    c.toLowerCase().includes(club.toLowerCase()) && c !== club
  )

  // Keyboard Handlers
  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (!showNameSuggestions || filteredPreregistrations.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setNameSelectedIndex(prev => (prev < filteredPreregistrations.length - 1 ? prev + 1 : prev))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setNameSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === "Enter" && nameSelectedIndex >= 0) {
      e.preventDefault()
      handlePreregistrationSelect(filteredPreregistrations[nameSelectedIndex])
    } else if (e.key === "Escape") {
      setShowNameSuggestions(false)
    }
  }

  const handleClubKeyDown = (e: React.KeyboardEvent) => {
    if (!showClubSuggestions || filteredClubs.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setClubSelectedIndex(prev => (prev < filteredClubs.length - 1 ? prev + 1 : prev))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setClubSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === "Enter" && clubSelectedIndex >= 0) {
      e.preventDefault()
      setClub(filteredClubs[clubSelectedIndex])
      setShowClubSuggestions(false)
      setClubSelectedIndex(-1)
    } else if (e.key === "Escape") {
      setShowClubSuggestions(false)
    }
  }

  return (
    <div className="space-y-8 py-4">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Formulaire */}
        <div className={`rounded-lg border p-4 shadow-sm transition-colors ${editingId ? 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800' : 'bg-card'}`}>
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{editingId ? "Modifier Participant" : "Nouveau Participant"} - {category}</h2>
              {editingId && (
                  <Button variant="ghost" size="sm" onClick={handleCancelEdit}>Annuler</Button>
              )}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2 relative">
                  <Label>Nom</Label>
                  <Input 
                    value={lastname} 
                    onChange={(e) => { setLastname(e.target.value); setShowNameSuggestions(true); setNameSelectedIndex(-1); }}
                    onFocus={() => setShowNameSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
                    onKeyDown={handleNameKeyDown}
                    placeholder="Nom" 
                    autoComplete="off"
                  />
                  {showNameSuggestions && filteredPreregistrations.length > 0 && !editingId && (
                      <div className="absolute z-10 w-full bg-popover border rounded-md shadow-md mt-1 max-h-60 overflow-auto">
                          {filteredPreregistrations.map((pre, idx) => (
                              <div 
                                  key={idx}
                                  className={`px-4 py-2 hover:bg-accent cursor-pointer text-sm ${idx === nameSelectedIndex ? 'bg-accent' : ''}`}
                                  onMouseDown={() => handlePreregistrationSelect(pre)}
                              >
                                  {pre.lastname} {pre.firstname} ({pre.club})
                              </div>
                          ))}
                      </div>
                  )}
               </div>
               <div className="space-y-2">
                  <Label>Prénom</Label>
                  <Input 
                    value={firstname} 
                    onChange={(e) => { setFirstname(e.target.value); setShowNameSuggestions(true); setNameSelectedIndex(-1); }} 
                    onFocus={() => setShowNameSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
                    onKeyDown={handleNameKeyDown}
                    placeholder="Prénom"
                    autoComplete="off" 
                  />
               </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Sexe</Label>
                <Select value={sex} onValueChange={(v: "M" | "F") => setSex(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Garçon</SelectItem>
                    <SelectItem value="F">Fille</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Année</Label>
                <Input type="number" value={birthYear} onChange={e => setBirthYear(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Poids (kg)</Label>
                <Input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2 relative">
              <Label>Club</Label>
              <Input 
                 placeholder="Nom du club" 
                 value={club} 
                 onChange={e => { setClub(e.target.value); setShowClubSuggestions(true); setClubSelectedIndex(-1); }}
                 onFocus={() => setShowClubSuggestions(true)}
                 onBlur={() => setTimeout(() => setShowClubSuggestions(false), 200)}
                 onKeyDown={handleClubKeyDown}
                 autoComplete="off"
              />
              {showClubSuggestions && filteredClubs.length > 0 && (
                  <div className="absolute z-10 w-full bg-popover border rounded-md shadow-md mt-1 max-h-60 overflow-auto">
                      {filteredClubs.map((c, idx) => (
                          <div 
                              key={c}
                              className={`px-4 py-2 hover:bg-accent cursor-pointer text-sm ${idx === clubSelectedIndex ? 'bg-accent' : ''}`}
                              onMouseDown={() => { setClub(c); setShowClubSuggestions(false); setClubSelectedIndex(-1); }}
                          >
                              {c}
                          </div>
                      ))}
                  </div>
              )}
            </div>

            <div className="flex gap-2">
                {editingId && (
                    <Button type="button" variant="destructive" onClick={handleDelete} className="px-3">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
                <Button type="submit" className="flex-1" variant={editingId ? "default" : "default"}>
                    {editingId ? "Modifier" : "Ajouter"}
                </Button>
            </div>
          </form>
        </div>

        {/* Liste */}
        <div className="rounded-lg border shadow-sm bg-card flex flex-col">
            <div className="p-4 border-b">
                <h2 className="font-semibold">Inscrits ({participants.length})</h2>
                <p className="text-xs text-muted-foreground">Cliquez pour modifier</p>
            </div>
            <div className="flex-1 overflow-auto max-h-[500px]">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nom</TableHead>
                            <TableHead>Club</TableHead>
                            <TableHead className="text-right">Poids</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedParticipants.map((p) => (
                            <TableRow 
                                key={p.id} 
                                className={cn(
                                    "cursor-pointer hover:bg-muted/50 transition-colors duration-500 border-l-4",
                                    p.sex === 'M' ? "border-l-blue-500" : "border-l-pink-500",
                                    editingId === p.id && "bg-muted",
                                    highlightedId === p.id && "bg-green-100 dark:bg-green-900/40"
                                )}
                                onClick={() => handleEditSelect(p)}
                            >
                                <TableCell className="font-medium">{p.lastname} {p.firstname}</TableCell>
                                <TableCell className="text-muted-foreground text-xs">{p.club}</TableCell>
                                <TableCell className="text-right whitespace-nowrap">{p.weight} kg</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
      </div>
    </div>
  )
}
