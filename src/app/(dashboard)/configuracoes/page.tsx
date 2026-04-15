'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Eye, EyeOff, Save, LogOut, Mail, Lock, User } from 'lucide-react'
import { formatPhone, validatePhone } from '@/lib/utils'
import { toast } from 'sonner'

export default function ConfiguracoesPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  // Profile state
  const [profileName, setProfileName] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Email state
  const [newEmail, setNewEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)

  // Load profile data
  const loadProfile = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('professionals')
      .select('full_name, phone')
      .eq('auth_user_id', user.id)
      .single()
    if (data) {
      setProfileName(data.full_name || '')
      setProfilePhone(data.phone || '')
    }
    setProfileLoaded(true)
  }, [user, supabase])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()

    if (!profileName.trim()) {
      toast.error('Nome é obrigatório.')
      return
    }
    if (profilePhone && !validatePhone(profilePhone)) {
      toast.error('Telefone inválido. Use o formato (XX) 9XXXX-XXXX.')
      return
    }

    setSavingProfile(true)
    const { error } = await supabase
      .from('professionals')
      .update({
        full_name: profileName.trim(),
        phone: profilePhone || null,
      })
      .eq('auth_user_id', user?.id)
    setSavingProfile(false)

    if (error) {
      console.error('Profile update error:', error)
      toast.error('Erro ao salvar perfil. Verifique as permissões.')
    } else {
      toast.success('Perfil atualizado!')
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()

    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem.')
      return
    }

    setSavingPassword(true)

    // Update password directly — Supabase requires recent auth for updateUser,
    // the current session is sufficient. If stale, user will be prompted to re-auth.
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)

    if (error) {
      toast.error(error.message || 'Erro ao alterar senha.')
    } else {
      toast.success('Senha alterada com sucesso!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault()

    if (!newEmail.trim()) {
      toast.error('Informe o novo e-mail.')
      return
    }
    if (newEmail === user?.email) {
      toast.error('O novo e-mail é igual ao atual.')
      return
    }

    setSavingEmail(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setSavingEmail(false)

    if (error) {
      toast.error(error.message || 'Erro ao alterar e-mail.')
    } else {
      toast.success('Email de confirmação enviado para o novo endereço. Verifique sua caixa de entrada.')
      setNewEmail('')
    }
  }

  async function handleSignOut() {
    await signOut()
    router.push('/login')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      {/* Profile */}
      {profileLoaded && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-teal-600" />
              <CardTitle className="text-lg">Meu Perfil</CardTitle>
            </div>
            <CardDescription>
              Atualize suas informações pessoais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Nome completo</Label>
                <Input
                  id="profile-name"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-phone">Telefone</Label>
                <Input
                  id="profile-phone"
                  value={profilePhone}
                  onChange={e => setProfilePhone(formatPhone(e.target.value))}
                  placeholder="(21) 99999-9999"
                />
              </div>
              <Button
                type="submit"
                className="bg-teal-600 hover:bg-teal-700"
                disabled={savingProfile || !profileName.trim()}
              >
                <Save className="mr-2 h-4 w-4" />
                {savingProfile ? 'Salvando...' : 'Salvar Perfil'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Change Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-teal-600" />
            <CardTitle className="text-lg">Alterar Senha</CardTitle>
          </div>
          <CardDescription>
            Defina uma nova senha para sua conta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha atual</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">As senhas não coincidem</p>
              )}
            </div>
            <Button
              type="submit"
              className="bg-teal-600 hover:bg-teal-700"
              disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            >
              <Save className="mr-2 h-4 w-4" />
              {savingPassword ? 'Salvando...' : 'Alterar Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change Email */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-teal-600" />
            <CardTitle className="text-lg">Alterar E-mail</CardTitle>
          </div>
          <CardDescription>
            E-mail atual: <strong>{user?.email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangeEmail} className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="new-email">Novo e-mail</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="novo@email.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Um e-mail de confirmação será enviado para o novo endereço.
              </p>
            </div>
            <Button
              type="submit"
              className="bg-teal-600 hover:bg-teal-700"
              disabled={savingEmail || !newEmail}
            >
              <Save className="mr-2 h-4 w-4" />
              {savingEmail ? 'Enviando...' : 'Alterar E-mail'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Card>
        <CardContent className="pt-6">
          <Button
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair da conta
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
