import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import QRCodeGenerator from '@/components/app/qr-code/QRCodeGenerator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode } from 'lucide-react';

export default async function QRCodeSettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const supabase = await createSupabaseAdminClient();

  // Get user's residence
  const { data: residence, error } = await supabase
    .from('residences')
    .select('id, name, qr_brand_color')
    .eq('syndic_user_id', session.user.id)
    .single();

  if (error || !residence) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:px-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">Residence not found or you don't have permission.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <QrCode className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold">QR Code Registration</h1>
        </div>
        <p className="text-gray-600">
          Generate and share a QR code for new residents to register themselves
        </p>
      </div>

      {/* Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>How it works</CardTitle>
          <CardDescription>
            New residents can scan this QR code to register themselves
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-gray-600">
            <li className="flex gap-2">
              <span className="font-semibold text-blue-600">1.</span>
              <span>Share the QR code or URL with new residents (post in lobby, send via email/WhatsApp)</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-blue-600">2.</span>
              <span>They scan the code and fill out the registration form with their details</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-blue-600">3.</span>
              <span>You review the request in the &quot;Registration Requests&quot; page</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-blue-600">4.</span>
              <span>Approve or reject - approved residents receive an onboarding code via email</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-blue-600">5.</span>
              <span>They use the code to complete setup in the mobile app</span>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* QR Code Generator */}
      <Card>
        <CardHeader>
          <CardTitle>Your Registration QR Code</CardTitle>
          <CardDescription>
            Download and share this QR code with prospective residents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QRCodeGenerator
            residenceName={residence.name}
            residenceId={residence.id}
            primaryColor={residence.qr_brand_color || '#1e40af'}
          />
        </CardContent>
      </Card>
    </div>
  );
}

