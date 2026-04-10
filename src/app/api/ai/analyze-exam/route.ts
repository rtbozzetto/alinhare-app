import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 })
    }

    const body = await request.json()
    const { examId } = body

    if (!examId) {
      return NextResponse.json({ error: 'examId é obrigatório' }, { status: 400 })
    }

    // Fetch exam record from DB
    const { data: exam, error: examError } = await supabase
      .from('patient_exams')
      .select('*')
      .eq('id', examId)
      .single()

    if (examError || !exam) {
      console.error('Exam fetch error:', examError)
      return NextResponse.json({ error: `Exame não encontrado: ${examError?.message ?? 'unknown'}` }, { status: 404 })
    }

    // Fetch patient data separately
    const { data: patient } = await supabase
      .from('patients')
      .select('*')
      .eq('id', exam.patient_id)
      .single()

    // Generate server-side signed URL and download the file
    let fileParts: any[] = []
    const { data: signedData, error: signError } = await supabase.storage
      .from('exam-files')
      .createSignedUrl(exam.file_url, 600)

    if (signError || !signedData?.signedUrl) {
      console.error('Signed URL error:', signError)
      return NextResponse.json({ error: `Erro ao acessar arquivo: ${signError?.message ?? 'URL não gerada'}` }, { status: 400 })
    }

    const fileResponse = await fetch(signedData.signedUrl)
    if (!fileResponse.ok) {
      return NextResponse.json({ error: `Erro ao baixar arquivo: HTTP ${fileResponse.status}` }, { status: 400 })
    }

    const fileBuffer = await fileResponse.arrayBuffer()
    const base64 = Buffer.from(fileBuffer).toString('base64')
    const contentType = fileResponse.headers.get('content-type') || exam.file_type || 'application/octet-stream'

    // Gemini supports images and PDFs
    if (contentType.startsWith('image/') || contentType === 'application/pdf') {
      fileParts.push({
        inlineData: {
          mimeType: contentType,
          data: base64,
        },
      })
    } else {
      fileParts.push({
        text: `[Arquivo: ${exam.file_name} - tipo: ${contentType}. Não é possível analisar visualmente este formato, use apenas a descrição do exame.]`,
      })
    }

    // Build patient context
    let patientContext = ''
    if (patient) {
      const age = patient.birth_date
        ? Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / 31557600000)
        : null

      patientContext = `
## Dados do Paciente
- Nome: ${patient.full_name || 'Não informado'}
- Idade: ${age ?? 'Não informada'}
- Sexo: ${patient.sex || 'Não informado'}
- Queixa principal: ${patient.main_complaint || 'Não informada'}
- Prática esportiva: ${patient.sport || 'Não informada'}
- Histórico cirúrgico: ${patient.surgery_history || 'Nenhum'}
- Medicamentos: ${patient.medication || 'Nenhum'}
- Problemas de saúde: ${patient.health_problems || 'Nenhum'}
${patient.discomfort_regions?.length ? `- Regiões de desconforto: ${patient.discomfort_regions.join(', ')}` : ''}
`
    }

    const prompt = `Você é um fisioterapeuta especialista, trabalhando na Clínica Alinhare.
Analise o exame médico a seguir e forneça uma interpretação detalhada e relevante para o tratamento fisioterapêutico.

## Sobre o Exame
- Arquivo: ${exam.file_name}
${exam.exam_description ? `- Descrição: ${exam.exam_description}` : ''}

${patientContext}

Forneça sua análise no seguinte formato:

### 1. Tipo de Exame
Identifique o tipo de exame (ressonância, raio-x, tomografia, ultrassom, laudo médico, etc.).

### 2. Achados Principais
Descreva os achados mais relevantes observados no exame, usando terminologia técnica adequada.

### 3. Correlação Clínica
Correlacione os achados com a queixa principal e o quadro clínico do paciente.

### 4. Implicações para o Tratamento
- Cuidados e precauções durante o tratamento
- Exercícios contraindicados ou que devem ser adaptados
- Abordagens terapêuticas recomendadas com base nos achados
- Prognóstico considerando os achados

### 5. Recomendações
Sugestões adicionais (outros exames, encaminhamentos, acompanhamento).

Seja objetivo, técnico e prático nas recomendações.`

    // Try multiple Gemini models (fallback on rate limit)
    const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite']
    const requestBody = JSON.stringify({
      contents: [
        {
          parts: [
            ...fileParts,
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      },
    })

    let geminiResponse: Response | null = null
    let lastError = ''
    let usedModel = ''

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

      geminiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      })

      if (geminiResponse.ok) {
        usedModel = model
        break
      }

      lastError = await geminiResponse.text()
      console.error(`Gemini ${model} error (${geminiResponse.status}):`, lastError)

      if (geminiResponse.status === 429 || geminiResponse.status === 503) {
        // Rate limited or overloaded, try next model
        console.log(`${model} returned ${geminiResponse.status}, trying next model...`)
        continue
      }

      // For non-429 errors, don't try other models
      break
    }

    if (!geminiResponse || !geminiResponse.ok) {
      const status = geminiResponse?.status ?? 502
      // Parse error details from Gemini response
      let errorDetail = ''
      try {
        const parsed = JSON.parse(lastError)
        errorDetail = parsed?.error?.message || parsed?.error?.status || ''
      } catch { errorDetail = lastError.slice(0, 300) }

      let msg: string
      if (status === 429) {
        msg = `Limite do Gemini atingido. ${errorDetail || 'Verifique sua cota em aistudio.google.com'}`
      } else if (status === 403) {
        msg = `API key sem permissão: ${errorDetail || 'Verifique se a Generative Language API está ativada.'}`
      } else if (status === 404) {
        msg = `Modelo não encontrado: ${errorDetail || 'Verifique se a API key é válida.'}`
      } else {
        msg = `Erro Gemini ${status}: ${errorDetail || 'erro desconhecido'}`
      }
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    const data = await geminiResponse.json()
    const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    console.log(`Exam analysis completed using model: ${usedModel}`)

    if (!analysisText) {
      return NextResponse.json({ error: 'A IA não gerou análise. Tente novamente.' }, { status: 502 })
    }

    // Save analysis to exam record
    const { error: updateError } = await supabase
      .from('patient_exams')
      .update({
        ai_analysis: analysisText,
        analyzed_at: new Date().toISOString(),
      })
      .eq('id', examId)

    if (updateError) {
      console.error('Update exam error:', updateError)
    }

    return NextResponse.json({
      analysis: analysisText,
      model: usedModel,
    })
  } catch (error: any) {
    console.error('Exam analysis error:', error)
    return NextResponse.json({ error: `Erro interno: ${error.message ?? 'desconhecido'}` }, { status: 500 })
  }
}
