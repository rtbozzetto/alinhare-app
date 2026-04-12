import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const EXPECTED_VIEWS: Record<string, string> = {
  frente: 'vista frontal (de frente), com o corpo inteiro visível da cabeça aos pés',
  costas: 'vista posterior (de costas), com o corpo inteiro visível da cabeça aos pés',
  lateral_direita: 'vista lateral direita, com o corpo inteiro visível da cabeça aos pés, lado direito do paciente voltado para a câmera',
  lateral_esquerda: 'vista lateral esquerda, com o corpo inteiro visível da cabeça aos pés, lado esquerdo do paciente voltado para a câmera',
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 })
  }

  const formData = await request.formData()
  const file = formData.get('photo') as File | null
  const photoType = formData.get('photo_type') as string | null

  if (!file || !photoType || !EXPECTED_VIEWS[photoType]) {
    return NextResponse.json({ error: 'Foto e tipo são obrigatórios' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mimeType = file.type || 'image/jpeg'

  const expectedView = EXPECTED_VIEWS[photoType]

  const promptText = `Você é um assistente de validação de fotos para análise postural em uma clínica de fisioterapia.

A foto enviada deveria ser uma ${expectedView}.

Analise a foto e verifique os critérios abaixo:

1. É uma foto de uma pessoa real em posição de pé (ortostática ou próxima)?
2. A maior parte do corpo está visível (pelo menos do topo da cabeça até os tornozelos)?
3. A cabeça está visível (pelo menos parcialmente)?
4. O ângulo é aproximadamente correto para o tipo esperado (${photoType === 'frente' ? 'frontal' : photoType === 'costas' ? 'posterior/de costas' : photoType === 'lateral_direita' ? 'lateral direito' : 'lateral esquerdo'})?
5. A iluminação permite ver a postura do paciente?
6. A imagem está razoavelmente nítida?

IMPORTANTE: Seja TOLERANTE. Pequenos cortes nos pés ou topo da cabeça são aceitáveis. Fotos de celular com qualidade normal são aceitáveis. O objetivo é garantir que a foto é útil para análise postural, não que seja perfeita.

A foto deve ser INVÁLIDA apenas se:
- Não é uma foto de uma pessoa de pé
- O ângulo está completamente errado (ex: foto de frente quando deveria ser de costas)
- A imagem está muito escura, borrada ou cortada de forma que impossibilita a análise
- Mostra menos da metade do corpo

Responda EXCLUSIVAMENTE com um JSON válido (sem markdown, sem crases), no formato:
{"valid": true ou false, "reason": "motivo se inválida, ou vazio se válida", "issues": ["lista de problemas encontrados"]}`

  const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite']
  const requestBody = JSON.stringify({
    contents: [{ parts: [{ inlineData: { mimeType, data: base64 } }, { text: promptText }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
  })

  try {
    let response: Response | null = null
    for (const model of models) {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody }
      )
      if (response.ok) break
      console.error(`Gemini ${model} error (${response.status}):`, await response.text())
      if (response.status === 429 || response.status === 503) continue
      break
    }

    if (!response || !response.ok) {
      return NextResponse.json({ error: `Erro na API de validação: ${response?.status ?? 'sem resposta'}` }, { status: 502 })
    }

    const data = await response.json()
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        return NextResponse.json(result)
      }
      return NextResponse.json({
        valid: false,
        reason: 'Não foi possível validar a foto. Tente novamente.',
        issues: [],
      })
    } catch {
      return NextResponse.json({
        valid: false,
        reason: 'Não foi possível validar a foto. Tente novamente.',
        issues: [],
      })
    }
  } catch (error) {
    console.error('Validation error:', error)
    return NextResponse.json({ error: 'Erro interno na validação' }, { status: 500 })
  }
}
