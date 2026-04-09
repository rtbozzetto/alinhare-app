import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // TODO: Integrate with AI provider (Gemini/OpenAI)
  // For now, return a placeholder
  const body = await request.json()
  return NextResponse.json({
    analysis: 'Análise postural em desenvolvimento. Configure a integração com provedor de IA.',
    type: body.type || 'single',
  })
}
