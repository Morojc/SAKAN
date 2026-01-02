import ResidenceRegistrationForm from '@/components/register/ResidenceRegistrationForm';

export default async function RegisterPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ResidenceRegistrationForm code={code} />;
}

