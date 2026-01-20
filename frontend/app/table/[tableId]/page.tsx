import { use } from "react"
import TableMatchView from "@/components/features/TableMatchView"

export default function TablePage({ params }: { params: Promise<{ tableId: string }> }) {
    const { tableId } = use(params)
    return <TableMatchView tableId={tableId} />
}
