import { OnboardingWizard } from "./_components/wizard"
import { getProfile } from "@auth/server"

export default async function OnboardingPage() {
  const profile = await getProfile()
  return (
    <OnboardingWizard
      defaultEmail={profile?.email ?? ""}
      defaultName={profile?.full_name ?? ""}
    />
  )
}
