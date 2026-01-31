import { use } from "react"
import TableMatchView from "@/components/features/TableMatchView"
import { decryptTableId } from "@/lib/table-crypto"

export default function TablePage({ params }: { params: Promise<{ tableId: string }> }) {
    const { tableId } = use(params)
    const decodedId = decryptTableId(decodeURIComponent(tableId))

    if (decodedId === null) {
        return <div className="p-8 text-center text-red-500">Table non trouvée ou lien invalide.</div>
    }

    return <TableMatchView tableId={decodedId.toString()} />
}
