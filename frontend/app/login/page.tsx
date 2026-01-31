import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Lock } from "lucide-react"

export default function LoginPage() {
  async function login(formData: FormData) {
    'use server'
    
    const password = formData.get('password')
    const correctPassword = process.env.ADMIN_PASSWORD || 'admin'
    
    if (password === correctPassword) {
      const cookieStore = await cookies()
      cookieStore.set('judo_auth', 'authenticated', { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7 // 1 week
      })
      redirect('/')
    } else {
        // Simple error handling for now (could be improved with useFormState)
        redirect('/login?error=Invalid password')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <div className="mx-auto bg-slate-100 p-3 rounded-full w-fit mb-2">
                <Lock className="h-6 w-6 text-slate-600" />
            </div>
            <CardTitle>Connexion Requise</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-4">
            <Input 
              type="password" 
              name="password" 
              placeholder="Mot de passe" 
              required 
              className="text-center"
              autoFocus
            />
            <Button type="submit" className="w-full">
              Se connecter
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}