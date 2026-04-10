'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const isRecovery = searchParams.get('type') === 'recovery'
  const code = searchParams.get('code')
  const router = useRouter()
  const { resetPassword, updatePassword } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Session state for recovery flow
  const [verifying, setVerifying] = useState(isRecovery || !!code)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState(false)

  useEffect(() => {
    if (!isRecovery && !code) return

    const supabase = createClient()
    let resolved = false

    function resolve(success: boolean) {
      if (resolved) return
      resolved = true
      if (success) {
        setSessionReady(true)
      } else {
        setSessionError(true)
      }
      setVerifying(false)
    }

    // Strategy 1: Exchange PKCE code if present
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error('Code exchange error:', error.message)
          // Don't resolve as error yet — maybe implicit flow will work
        } else {
          resolve(true)
        }
      })
    }

    // Strategy 2: Listen for PASSWORD_RECOVERY event (implicit flow / hash tokens)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, !!session)
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        resolve(true)
      }
    })

    // Strategy 3: Check if session already exists (hash might be auto-processed)
    const checkSession = async () => {
      // Small delay to allow Supabase to process hash tokens
      await new Promise(r => setTimeout(r, 1000))
      if (resolved) return
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        resolve(true)
      }
    }
    checkSession()

    // Timeout: if nothing worked after 5 seconds, show error
    const timeout = setTimeout(() => {
      if (!resolved) {
        console.error('Session verification timed out')
        resolve(false)
      }
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [isRecovery, code])

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await resetPassword(email)
    setLoading(false)
    if (error) {
      toast.error('Erro ao enviar e-mail de recuperação.')
    } else {
      setSent(true)
      toast.success('E-mail de recuperação enviado!')
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.')
      return
    }
    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) {
      console.error('Update password error:', error)
      toast.error('Erro ao atualizar senha. O link pode ter expirado.')
    } else {
      toast.success('Senha definida com sucesso!')
      router.push('/login')
    }
  }

  // Recovery mode
  if (isRecovery || code) {
    // Loading: verifying the link
    if (verifying) {
      return (
        <Card className="w-full max-w-sm">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
              <p className="text-sm text-muted-foreground">Verificando link...</p>
            </div>
          </CardContent>
        </Card>
      )
    }

    // Error: link expired or invalid
    if (sessionError) {
      return (
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-teal-600">
              Link Expirado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Este link de recuperação expirou ou já foi utilizado. Solicite um novo.
            </p>
            <Link href="/reset-password">
              <Button variant="outline" className="w-full">
                Solicitar novo link
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="w-full text-teal-600">
                Voltar ao login
              </Button>
            </Link>
          </CardContent>
        </Card>
      )
    }

    // Session ready: show password form
    if (sessionReady) {
      return (
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-teal-600">
              Bem-vindo(a) à Alinhare
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Defina sua senha de acesso
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirm(!showConfirm)}
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-500">As senhas não coincidem</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full bg-teal-600 hover:bg-teal-700"
                disabled={loading || !password || !confirmPassword || password !== confirmPassword}
              >
                {loading ? 'Salvando...' : 'Definir senha'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )
    }
  }

  // Request mode: user wants to reset password
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-teal-600">
          Recuperar Senha
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Informe seu e-mail para receber o link de recuperação
        </p>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Enviamos um link de recuperação para <strong>{email}</strong>.
              Verifique sua caixa de entrada e spam.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Voltar ao login
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-700"
              disabled={loading}
            >
              {loading ? 'Enviando...' : 'Enviar link de recuperação'}
            </Button>
            <div className="text-center">
              <Link
                href="/login"
                className="text-sm text-teal-600 hover:underline"
              >
                Voltar ao login
              </Link>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Suspense
        fallback={
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          </div>
        }
      >
        <ResetPasswordContent />
      </Suspense>
    </div>
  )
}
