'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Loader2, UserCog, ShieldCheck } from 'lucide-react'
import { transferSyndicRole } from '@/app/admin/residences/actions'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface Resident {
  id: string
  full_name: string | null
  phone_number: string | null
  role: string
  avatar_url?: string | null
}

interface ResidenceResidentsListProps {
  residents: Resident[]
  residenceId: number
  currentSyndicId: string | null
}

export function ResidenceResidentsList({ residents, residenceId, currentSyndicId }: ResidenceResidentsListProps) {
  const [isPromoting, setIsPromoting] = useState<string | null>(null)

  const handlePromote = async (residentId: string) => {
    try {
      setIsPromoting(residentId)
      const result = await transferSyndicRole({
        residenceId,
        newSyndicId: residentId
      })

      if (result.success) {
        toast.success('Rôle de syndic transféré avec succès')
      } else {
        toast.error(result.error || 'Erreur lors du transfert du rôle')
      }
    } catch {
      toast.error('Une erreur est survenue')
    } finally {
      setIsPromoting(null)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Résidents ({residents.length})</h3>
      <div className="grid gap-4">
        {residents.map((resident) => {
          const isSyndic = resident.id === currentSyndicId
          
          return (
            <div
              key={resident.id}
              className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm"
            >
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarImage src={resident.avatar_url || undefined} />
                  <AvatarFallback>{resident.full_name?.substring(0, 2).toUpperCase() || 'UN'}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{resident.full_name || 'Utilisateur sans nom'}</p>
                    {isSyndic && (
                      <Badge variant="default" className="bg-green-600">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Syndic Actuel
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{resident.phone_number || 'Pas de numéro'}</p>
                </div>
              </div>

              {!isSyndic && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={!!isPromoting}>
                      {isPromoting === resident.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <UserCog className="w-4 h-4 mr-2" />
                          Promouvoir Syndic
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmer le transfert de rôle</AlertDialogTitle>
                      <AlertDialogDescription>
                        Êtes-vous sûr de vouloir nommer <strong>{resident.full_name}</strong> comme nouveau syndic ?
                        <br /><br />
                        ⚠️ Le syndic actuel perdra ses droits d'administration sur cette résidence.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handlePromote(resident.id)}
                      >
                        Confirmer le transfert
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )
        })}
        {residents.length === 0 && (
          <p className="text-center text-gray-500 py-4">Aucun résident trouvé pour cette résidence.</p>
        )}
      </div>
    </div>
  )
}

