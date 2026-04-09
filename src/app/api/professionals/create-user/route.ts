import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServerSupabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    // 1. Verify the caller is admin
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const { data: roleData } = await supabase.rpc('get_user_role', { _user_id: user.id })
    if (roleData !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    // 2. Parse body
    const body = await request.json()
    const email = body.email
    const professional_id = body.professional_id || body.professionalId
    if (!email || !professional_id) {
      return NextResponse.json({ error: 'Email e professional_id são obrigatórios' }, { status: 400 })
    }

    // 3. Create auth user with admin client
    const admin = await createServerSupabaseAdmin()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alinhare-app.vercel.app'

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { role: 'profissional' },
    })
    if (authError) {
      // Check if user already exists
      const { data: existingUsers } = await admin.auth.admin.listUsers()
      const existing = existingUsers?.users?.find((u: any) => u.email === email)
      if (existing) {
        // Link existing user
        await admin.from('professionals').update({ auth_user_id: existing.id }).eq('id', professional_id)
        await admin.from('user_roles').upsert({ user_id: existing.id, role: 'profissional' }, { onConflict: 'user_id,role' })
        // Send password reset email
        await admin.auth.resetPasswordForEmail(email, {
          redirectTo: `${siteUrl}/auth/callback?next=/reset-password?type=recovery`,
        })
        return NextResponse.json({ success: true, user_id: existing.id, already_existed: true })
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 4. Link to professional and assign role
    await admin.from('professionals').update({ auth_user_id: authData.user.id }).eq('id', professional_id)
    await admin.from('user_roles').insert({ user_id: authData.user.id, role: 'profissional' })

    // 5. Generate recovery link and try to send email
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${siteUrl}/reset-password` },
    })

    // Also try sending the email via resetPasswordForEmail
    await admin.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password?type=recovery`,
    })

    const actionLink = linkData?.properties?.action_link || null

    return NextResponse.json({
      success: true,
      user_id: authData.user.id,
      already_existed: false,
      recovery_link: actionLink,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
