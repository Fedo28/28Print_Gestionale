import { DashboardPage } from "@/components/dashboard-page";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: {
    panel?: string;
    focus?: string;
    day?: string;
    dayFocus?: string;
    readyMode?: string;
    financeMode?: string;
    financeBucket?: string;
    financeSort?: string;
    materials?: string;
    pulse?: string;
  };
};

export default async function Page({ searchParams }: Props) {
  await requireAuth();
  return (
    <DashboardPage
      day={searchParams?.day}
      dayFocus={searchParams?.dayFocus}
      financeBucket={searchParams?.financeBucket}
      financeMode={searchParams?.financeMode}
      financeSort={searchParams?.financeSort}
      focus={searchParams?.focus}
      materials={searchParams?.materials}
      panel={searchParams?.panel}
      pulse={searchParams?.pulse}
      readyMode={searchParams?.readyMode}
    />
  );
}
