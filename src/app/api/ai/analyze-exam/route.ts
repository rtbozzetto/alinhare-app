import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
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
    .select('*, patient:patients(*)')
    .eq('id', examId)
    .single()

  if (examError || !exam) {
    return NextResponse.json({ error: 'Exame não encontrado' }, { status: 404 })
  }

  // Generate server-side signed URL and download the file
  let fileParts: any[] = []
  try {
    const { data: signedData, error: signError } = await supabase.storage
      .from('exam-files')
      .createSignedUrl(exam.file_url, 600)

    if (signError || !signedData?.signedUrl) {
      console.error('Failed to create signed URL:', signError)
      return NextResponse.json({ error: 'Não foi possível acessar o arquivo do exame' }, { status: 400 })
    }

    const fileResponse = await fetch(signedData.signedUrl)
    if (!fileResponse.ok) {
      return NextResponse.json({ error: 'Não foi possível baixar o arquivo do exame' }, { status: 400 })
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
  } catch (err) {
    console.error('Failed to fetch exam file:', err)
    return NextResponse.json({ error: 'Erro ao carregar arquivo do exame' }, { status: 500 })
  }

  // Build patient context
  const patient = exam.patient
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

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error('Gemini API error:', errText)
      return NextResponse.json({ error: 'Erro na API de análise' }, { status: 502 })
    }

    const data = await response.json()
    const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    if (!analysisText) {
      return NextResponse.json({ error: 'A IA não gerou análise. Tente novamente.' }, { status: 502 })
    }

    // Save analysis to exam record
    await supabase
      .from('patient_exams')
      .update({
        ai_analysis: analysisText,
        analyzed_at: new Date().toISOString(),
      })
      .eq('id', examId)

    return NextResponse.json({
      analysis: analysisText,
      model: 'gemini-2.0-flash',
    })
  } catch (error) {
    console.error('Exam analysis error:', error)
    return NextResponse.json({ error: 'Erro interno na análise' }, { status: 500 })
  }
}
