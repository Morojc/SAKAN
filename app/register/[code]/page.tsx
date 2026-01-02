import ResidenceRegistrationForm from '@/components/register/ResidenceRegistrationForm';

export default function RegisterPage({ params }: { params: { code: string } }) {
  return <ResidenceRegistrationForm code={params.code} />;
}

