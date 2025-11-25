'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { createResidence } from '@/app/admin/residences/actions'

export function CreateResidenceForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

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

