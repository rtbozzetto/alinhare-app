import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServerSupabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    // 1. Verify admin
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
    const { professional_id, action } = await request.json()
    if (!professional_id || !action) {
      return NextResponse.json({ error: 'professional_id e action são obrigatórios' }, { status: 400 })
    }

    const admin = await createServerSupabaseAdmin()

    // 3. Get professional
    const { data: prof } = await admin.from('professionals').select('auth_user_id').eq('id', professional_id).single()
    if (!prof?.auth_user_id) {
      return NextResponse.json({ error: 'Profissional não encontrado ou sem acesso' }, { status: 404 })
    }

    if (action === 'ban') {
      await admin.auth.admin.updateUserById(prof.auth_user_id, { ban_duration: '876600h' }) // 100 years
      await admin.from('professionals').update({ active: false }).eq('id', professional_id)
    } else if (action === 'unban') {
      await admin.auth.admin.updateUserById(prof.auth_user_id, { ban_duration: 'none' })
      await admin.from('professionals').update({ active: true }).eq('id', professional_id)
    } else if (action === 'delete') {
      await admin.auth.admin.deleteUser(prof.auth_user_id)
      await admin.from('professionals').update({ auth_user_id: null, active: false }).eq('id', professional_id)
    } else {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
