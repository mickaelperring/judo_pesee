"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft } from "lucide-react"
import Link from "next/link"

const QRCode = dynamic(() => import("react-qr-code"), { ssr: false })

export default function QRCodeView({ token, tableId }: { token: string, tableId: number }) {
    const [url, setUrl] = useState("")

    useEffect(() => {
        // Construct the full URL for the QR code
        setUrl(`${window.location.origin}/table/${token}`)
    }, [token])

    if (!url) return null

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-black print:p-0">
            <div className="fixed top-4 left-4 print:hidden">
                <Link href="/">
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
            </div>

            <div className="flex flex-col items-center gap-8 max-w-md w-full text-center">
                <div className="space-y-2">
                    <h1 className="text-4xl font-black uppercase tracking-widest border-b-4 border-black pb-2">
                        Table {tableId}
                    </h1>
                    <p className="text-xl font-medium text-slate-600">
                        Scannez pour suivre les combats
                    </p>
                </div>

                <div className="p-4 border-4 border-black rounded-3xl bg-white shadow-xl">
                    <QRCode 
                        value={url} 
                        size={256} 
                        level="H"
                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                        viewBox={`0 0 256 256`}
                    />
                </div>

                <div className="space-y-1">
                    <p className="font-mono text-sm break-all text-slate-400">
                        {url}
                    </p>
                </div>

                <div className="print:hidden mt-8">
                    <Button onClick={() => window.print()} size="lg" className="gap-2">
                        <Printer className="h-5 w-5" /> Imprimer
                    </Button>
                </div>
            </div>
        </div>
    )
}