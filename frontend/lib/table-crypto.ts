import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// Use a fixed key for simplicity in this environment, but in production this should be an env var.
// We pad/truncate to 32 bytes for AES-256.
const SECRET_KEY = Buffer.alloc(32)
SECRET_KEY.write(process.env.ADMIN_PASSWORD || 'judo_pesee_montlebon_secure_key_default', 0, 32, 'utf-8')

export function encryptTableId(id: number): string {
  try {
      const iv = randomBytes(16)
      const cipher = createCipheriv('aes-256-cbc', SECRET_KEY, iv)
      let encrypted = cipher.update(id.toString(), 'utf8', 'hex')
      encrypted += cipher.final('hex')
      // Return IV + Encrypted data
      return iv.toString('hex') + ':' + encrypted
  } catch (e) {
      console.error("Encryption error:", e)
      return ""
  }
}

export function decryptTableId(token: string): number | null {
  try {
    const parts = token.split(':')
    if (parts.length !== 2) return null
    
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    
    const decipher = createDecipheriv('aes-256-cbc', SECRET_KEY, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    const id = parseInt(decrypted)
    return isNaN(id) ? null : id
  } catch (e) {
    console.error("Decryption error:", e)
    return null
  }
}
