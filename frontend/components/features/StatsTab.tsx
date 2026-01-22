"use client"

import { useState, useEffect } from "react"
import { getStats } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import { StatsResponse } from "@/types"

export default function StatsTab() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // setLoading(true) is implicit by initial state
    getStats().then(setStats).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-center">Chargement...</div>
  if (!stats) return <div className="p-8 text-center">Aucune donnée</div>

  return (
    <div className="py-4 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Classement par Club</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Club</TableHead>
                                <TableHead className="text-right">Inscrits</TableHead>
                                <TableHead className="text-right">Victoires</TableHead>
                                <TableHead className="text-right">Points Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.by_club.sort((a, b) => {
                                if (b.total_victories !== a.total_victories) return b.total_victories - a.total_victories
                                return b.total_score - a.total_score
                            }).map((s) => (
                                <TableRow key={s.club}>
                                    <TableCell className="font-medium">{s.club}</TableCell>
                                    <TableCell className="text-right">{s.count}</TableCell>
                                    <TableCell className="text-right">{s.total_victories}</TableCell>
                                    <TableCell className="text-right font-bold">{s.total_score}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Participants sans score ({stats.warnings.length})</CardTitle>
                </CardHeader>
                <CardContent className="max-h-[500px] overflow-auto">
                    {stats.warnings.length > 0 ? (
                        <div className="space-y-2">
                             <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Attention</AlertTitle>
                                <AlertDescription>
                                    Ces participants n&apos;ont pas encore de score enregistré.
                                </AlertDescription>
                            </Alert>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nom</TableHead>
                                        <TableHead>Catégorie</TableHead>
                                        <TableHead>Poule</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stats.warnings.map((p) => (
                                        <TableRow key={p.id}>
                                            <TableCell>{p.lastname} {p.firstname}</TableCell>
                                            <TableCell>{p.category}</TableCell>
                                            <TableCell>{p.pool_number || "-"}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-muted-foreground text-center py-8">Tous les participants ont un score.</div>
                    )}
                </CardContent>
            </Card>
        </div>
    </div>
  )
}
