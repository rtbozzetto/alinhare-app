'use client'

import { useState } from 'react'
import { usePriceTables, type ProtocolKey, type PriceCategory } from '@/hooks/use-price-tables'
import { AdminGuard } from '@/components/layout/admin-guard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Check, Pencil, X, Star } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { type PriceProtocol } from '@/types/database'

export default function PrecosPage() {
  return (
    <AdminGuard>
      <PrecosContent />
    </AdminGuard>
  )
}

function PrecosContent() {
  const { grouped, loading, updatePrice } = usePriceTables()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const protocols: ProtocolKey[] = ['janaina', 'quiropraxistas']
  const categories: { key: PriceCategory; label: string }[] = [
    { key: 'evaluation', label: 'Avaliacao' },
    { key: 'treatment', label: 'Tratamento' },
    { key: 'maintenance', label: 'Manutencao' },
  ]

  function startEdit(item: PriceProtocol) {
    setEditingId(item.id)
    setEditValue(String(item.price))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValue('')
  }

  async function saveEdit(id: string) {
    const numValue = parseFloat(editValue)
    if (isNaN(numValue) || numValue < 0) {
      toast.error('Valor invalido.')
      return
    }
    const { error } = await updatePrice(id, { price: numValue })
    if (error) {
      toast.error('Erro ao atualizar preco.')
    } else {
      toast.success('Preco atualizado!')
    }
    setEditingId(null)
    setEditValue('')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tabela de Precos</h1>

      <Tabs defaultValue="janaina">
        <TabsList>
          {protocols.map(proto => (
            <TabsTrigger key={proto} value={proto}>
              {grouped[proto].label}
            </TabsTrigger>
          ))}
        </TabsList>

        {protocols.map(proto => (
          <TabsContent key={proto} value={proto} className="space-y-6">
            {categories.map(cat => {
              const items = grouped[proto][cat.key]
              if (items.length === 0) return null

              return (
                <Card key={cat.key}>
                  <CardHeader>
                    <CardTitle className="text-lg">{cat.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {items.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.plan_name}</span>
                              {item.recommended && (
                                <Badge variant="default" className="bg-teal-600 text-[10px]">
                                  <Star className="mr-0.5 h-2.5 w-2.5" />
                                  Recomendado
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {item.sessions} {item.sessions === 1 ? 'sessao' : 'sessoes'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {editingId === item.id ? (
                            <>
                              <Input
                                type="number"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                className="w-28"
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveEdit(item.id)
                                  if (e.key === 'Escape') cancelEdit()
                                }}
                                autoFocus
                              />
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => saveEdit(item.id)}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={cancelEdit}
                              >
                                <X className="h-4 w-4 text-red-500" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="text-lg font-bold text-teal-600">
                                {formatCurrency(item.price)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => startEdit(item)}
                              >
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
