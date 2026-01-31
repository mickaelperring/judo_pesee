'use server'

import { encryptTableId } from '@/lib/table-crypto'

export async function getTableToken(tableId: number): Promise<string> {
    return encryptTableId(tableId)
}
