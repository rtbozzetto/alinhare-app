import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })
  }

  const body = await request.json()
  const {
    photoUrls,        // { frente?: string, costas?: string, lateral_direita?: string, lateral_esquerda?: string }
    patientData,      // { full_name, birth_date, sex, height_cm, main_complaint, discomfort_regions, discomfort_intensities, discomfort_frequency, discomfort_duration, sport, surgery_history, medication, health_problems }
    exams,            // [{ exam_description, ai_analysis }]
    previousAnalysis, // string | null — texto da análise anterior
    sessionNumber,    // number
  } = body

  if (!photoUrls || Object.keys(photoUrls).length === 0) {
    return NextResponse.json({ error: 'É necessário pelo menos uma foto' }, { status: 400 })
  }

  // Build image content blocks from signed URLs
  const imageBlocks: any[] = []
  const viewLabels: Record<string, string> = {
    frente: 'Vista Frontal',
    costas: 'Vista Posterior',
    lateral_direita: 'Vista Lateral Direita',
    lateral_esquerda: 'Vista Lateral Esquerda',
  }

  for (const [type, url] of Object.entries(photoUrls)) {
    if (!url) continue

    // Fetch the image and convert to base64
    try {
      const imgResponse = await fetch(url as string)
      if (!imgResponse.ok) continue
      const imgBuffer = await imgResponse.arrayBuffer()
      const base64 = Buffer.from(imgBuffer).toString('base64')
      const contentType = imgResponse.headers.get('content-type') || 'image/jpeg'

      imageBlocks.push({
        type: 'text',
        text: `📷 ${viewLabels[type] || type}:`,
      })
      imageBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: contentType,
          data: base64,
        },
      })
    } catch (err) {
      console.error(`Failed to fetch image ${type}:`, err)
    }
  }

  if (imageBlocks.length === 0) {
    return NextResponse.json({ error: 'Não foi possível carregar as fotos' }, { status: 400 })
  }

  // Build patient context
  let patientContext = ''
  if (patientData) {
    const age = patientData.birth_date
      ? Math.floor((Date.now() - new Date(patientData.birth_date).getTime()) / 31557600000)
      : null

    patientContext = `
## Dados do Paciente
- Nome: ${patientData.full_name || 'Não informado'}
- Idade: ${age ?? 'Não informada'}
- Sexo: ${patientData.sex || 'Não informado'}
- Altura: ${patientData.height_cm ? `${patientData.height_cm}m` : 'Não informada'}
- Queixa principal: ${patientData.main_complaint || 'Não informada'}
- Prática esportiva: ${patientData.sport || 'Não informada'}
- Histórico cirúrgico: ${patientData.surgery_history || 'Nenhum'}
- Medicamentos: ${patientData.medication || 'Nenhum'}
- Problemas de saúde: ${patientData.health_problems || 'Nenhum'}
${patientData.discomfort_regions?.length ? `- Regiões de desconforto: ${patientData.discomfort_regions.join(', ')}` : ''}
${patientData.discomfort_frequency ? `- Frequência do desconforto: ${patientData.discomfort_frequency}` : ''}
${patientData.discomfort_duration ? `- Duração do desconforto: ${patientData.discomfort_duration}` : ''}
${patientData.discomfort_intensities ? `- Intensidades: ${JSON.stringify(patientData.discomfort_intensities)}` : ''}
`
  }

  let examContext = ''
  if (exams?.length) {
    examContext = `
## Exames do Paciente
${exams.map((e: any, i: number) => `### Exame ${i + 1}: ${e.exam_description || 'Sem descrição'}
${e.ai_analysis ? `Análise prévia: ${e.ai_analysis}` : 'Sem análise prévia'}`).join('\n\n')}
`
  }

  let comparisonContext = ''
  if (previousAnalysis) {
    comparisonContext = `
## Análise Postural Anterior
${previousAnalysis}
`
  }

  const systemPrompt = `Você é um fisioterapeuta especialista em análise postural, trabalhando na clínica Alinhare.
Sua função é realizar uma análise postural detalhada baseada nas fotos do paciente, considerando todo o contexto clínico disponível.

Seja preciso, técnico e objetivo. Use terminologia adequada da fisioterapia.
Organize sua análise em seções claras.`

  const userPrompt = `Realize uma análise postural completa deste paciente (Sessão ${sessionNumber || 'N/A'}).

${patientContext}
${examContext}
${comparisonContext}

Analise as fotos posturais abaixo e forneça:

## Estrutura da Análise

### 1. Análise por Vista
Para cada foto disponível, descreva detalhadamente as alterações posturais observadas:
- Alinhamento da cabeça/cervical
- Ombros (nivelamento, protração/retração)
- Coluna (cifose, lordose, escoliose)
- Pelve (báscula, rotação)
- Joelhos (valgo, varo, recurvatum)
- Tornozelos/pés (pronação, supinação)

### 2. Diagnóstico Postural
Resumo das principais alterações encontradas, correlacionando com a queixa principal e regiões de desconforto do paciente.

### 3. Sugestões de Tratamento
- Exercícios corretivos específicos recomendados
- Alongamentos prioritários
- Fortalecimentos necessários
- Técnicas manuais indicadas
- Orientações posturais para o dia a dia

### 4. Prognóstico
Expectativa de evolução considerando as alterações encontradas.

${previousAnalysis ? `### 5. Comparação com Análise Anterior
Compare os achados atuais com a análise anterior. Destaque:
- O que melhorou
- O que piorou
- O que permanece igual
- Ajustes recomendados no plano de tratamento` : ''}

Seja detalhado e prático nas recomendações.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              ...imageBlocks,
              { type: 'text', text: userPrompt },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Anthropic API error:', errText)
      return NextResponse.json({ error: 'Erro na API de análise' }, { status: 502 })
    }

    const data = await response.json()
    const analysisText = data.content?.find((c: any) => c.type === 'text')?.text ?? ''

    return NextResponse.json({
      analysis: analysisText,
      type: previousAnalysis ? 'compare' : 'single',
      model: 'claude-sonnet-4-6',
    })
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json({ error: 'Erro interno na análise' }, { status: 500 })
  }
}
