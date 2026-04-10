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
    const adminClient = await createServerSupabaseAdmin()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alinhare-app.vercel.app'

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { role: 'profissional' },
    })
    if (authError) {
      console.error('[create-user] createUser error:', authError.message)
      // Check if user already exists
      const { data: existingUsers } = await adminClient.auth.admin.listUsers()
      const existing = existingUsers?.users?.find((u: any) => u.email === email)
      if (existing) {
        // Link existing user
        await adminClient.from('professionals').update({ auth_user_id: existing.id }).eq('id', professional_id)
        await adminClient.from('user_roles').upsert({ user_id: existing.id, role: 'profissional' }, { onConflict: 'user_id,role' })

        // Send recovery email (this sends the email AND generates the token)
        const { error: resetError } = await adminClient.auth.resetPasswordForEmail(email, {
          redirectTo: `${siteUrl}/auth/callback?next=/reset-password?type=recovery`,
        })
        console.log('[create-user] existing user resetPasswordForEmail:', resetError?.message || 'ok')

        // Generate link as fallback for manual sharing (MUST be last to keep token valid)
        const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo: `${siteUrl}/auth/callback?next=/reset-password?type=recovery` },
        })
        console.log('[create-user] existing user generateLink:', linkError?.message || 'ok')

        return NextResponse.json({
          success: true,
          user_id: existing.id,
          already_existed: true,
          recovery_link: linkData?.properties?.action_link || null,
        })
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 4. Link to professional and assign role
    await adminClient.from('professionals').update({ auth_user_id: authData.user.id }).eq('id', professional_id)
    await adminClient.from('user_roles').insert({ user_id: authData.user.id, role: 'profissional' })

    // 5. Send recovery email so professional can set password
    const { error: resetError } = await adminClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password?type=recovery`,
    })
    console.log('[create-user] resetPasswordForEmail:', resetError?.message || 'ok')

    // 6. Generate link as fallback for manual sharing (MUST be last to keep token valid)
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${siteUrl}/auth/callback?next=/reset-password?type=recovery` },
    })
    console.log('[create-user] generateLink:', linkError?.message || 'ok')

    return NextResponse.json({
      success: true,
      user_id: authData.user.id,
      already_existed: false,
      recovery_link: linkData?.properties?.action_link || null,
    })
  } catch (err) {
    console.error('[create-user] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
