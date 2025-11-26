import { auth } from "@/lib/auth";
import DayosHome from "@/components/landing/DayosHome";

export default async function Home() {
  const session = await auth();
  const user = session?.user;

  return <DayosHome user={user} />;
}
