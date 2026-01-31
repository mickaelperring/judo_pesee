import { decryptTableId } from "@/lib/table-crypto"
import QRCodeView from "@/components/features/QRCodeView"

export default async function QRCodePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const decodedToken = decodeURIComponent(token)
    const tableId = decryptTableId(decodedToken)

    if (tableId === null) {
        return (
            <div className="flex h-screen items-center justify-center text-red-500 font-bold">
                Jeton de table invalide
            </div>
        )
    }

    return <QRCodeView token={decodedToken} tableId={tableId} />
}