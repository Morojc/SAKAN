'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, User } from 'lucide-react'
import { createResidence } from '@/app/admin/residences/actions'

interface Syndic {
  id: string
  full_name: string
  email: string
}

export function CreateResidenceForm({ availableSyndics }: { availableSyndics: Syndic[] }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [selectedSyndicId, setSelectedSyndicId] = useState<string>('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get('name') as string,
      address: formData.get('address') as string,
      city: formData.get('city') as string,
      bank_account_rib: formData.get('bank_account_rib') as string,
      syndic_user_id: selectedSyndicId || undefined,
    }

    try {
      const result = await createResidence(data)

      if (result.success) {
        router.push('/admin/residences')
        router.refresh()
      } else {
        setError(result.error || 'Une erreur est survenue')
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <Label htmlFor="name">
          Nom de la résidence <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="Ex: Résidence Les Jardins"
          className="mt-2"
          disabled={isSubmitting}
        />
      </div>

      {/* Address */}
      <div>
        <Label htmlFor="address">
          Adresse <span className="text-red-500">*</span>
        </Label>
        <Input
          id="address"
          name="address"
          required
          placeholder="Ex: 123 Avenue Mohammed V"
          className="mt-2"
          disabled={isSubmitting}
        />
      </div>

      {/* City */}
      <div>
        <Label htmlFor="city">
          Ville <span className="text-red-500">*</span>
        </Label>
        <Input
          id="city"
          name="city"
          required
          placeholder="Ex: Casablanca"
          className="mt-2"
          disabled={isSubmitting}
        />
      </div>

      {/* Bank Account RIB */}
      <div>
        <Label htmlFor="bank_account_rib">
          RIB (optionnel)
        </Label>
        <Input
          id="bank_account_rib"
          name="bank_account_rib"
          placeholder="Ex: 123456789012345678901234"
          className="mt-2"
          disabled={isSubmitting}
          maxLength={24}
        />
        <p className="text-xs text-gray-500 mt-1">
          Compte bancaire de la résidence pour les paiements
        </p>
      </div>

      {/* Syndic Assignment */}
      <div>
        <Label htmlFor="syndic">
          Assigner un syndic (optionnel)
        </Label>
        <Select value={selectedSyndicId} onValueChange={setSelectedSyndicId} disabled={isSubmitting}>
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="Sélectionnez un syndic" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Aucun syndic (assigner plus tard)</SelectItem>
            {availableSyndics.map((syndic) => (
              <SelectItem key={syndic.id} value={syndic.id}>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <div>
                    <p className="font-medium">{syndic.full_name}</p>
                    <p className="text-xs text-gray-500">{syndic.email}</p>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          Vous pouvez assigner un syndic maintenant ou plus tard
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
          className="flex-1"
        >
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Création...
            </>
          ) : (
            'Créer la résidence'
          )}
        </Button>
      </div>
    </form>
  )
}

