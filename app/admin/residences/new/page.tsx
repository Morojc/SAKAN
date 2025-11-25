import { CreateResidenceForm } from "@/components/admin/CreateResidenceForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2 } from "lucide-react"

export default function NewResidencePage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Building2 className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle résidence</h1>
          <p className="text-gray-500">Créez une nouvelle résidence à assigner aux syndics</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations de la résidence</CardTitle>
          <CardDescription>
            Remplissez les informations de la nouvelle résidence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateResidenceForm />
        </CardContent>
      </Card>
    </div>
  )
}

