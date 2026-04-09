'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Smartphone } from 'lucide-react'

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100">
            <Smartphone className="h-8 w-8 text-teal-600" />
          </div>
          <CardTitle>Alinhare</CardTitle>
          <p className="text-sm text-muted-foreground">Sistema Interno</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {isInstalled ? (
            <p className="text-muted-foreground">
              O app já está instalado no seu dispositivo.
            </p>
          ) : deferredPrompt ? (
            <Button
              onClick={handleInstall}
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              <Download className="mr-2 h-4 w-4" />
              Adicionar à Tela de Início
            </Button>
          ) : (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Adicione o app à tela inicial do seu celular para acesso rápido.
              </p>
              <p className="font-medium text-foreground">No iPhone/Safari:</p>
              <p>
                Toque no ícone de compartilhar e selecione &quot;Adicionar à Tela de Início&quot;
              </p>
              <p className="font-medium text-foreground">No Android/Chrome:</p>
              <p>
                Toque nos 3 pontos e selecione &quot;Adicionar à tela inicial&quot;
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
