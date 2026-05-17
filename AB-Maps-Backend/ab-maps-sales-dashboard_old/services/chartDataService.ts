export type PerformanceData = { name: string; calls: number; orders: number };
export type CampaignData = { name: string; value: number };
export type ConversionData = { name: string; value: number };

const dummyPerformance: PerformanceData[] = [
  { name: "9:00", calls: 4, orders: 1 },
  { name: "10:00", calls: 6, orders: 2 },
  { name: "11:00", calls: 8, orders: 3 },
  { name: "12:00", calls: 3, orders: 1 },
  { name: "13:00", calls: 7, orders: 4 },
  { name: "14:00", calls: 5, orders: 2 },
  { name: "15:00", calls: 9, orders: 5 },
];

const dummyCampaigns: CampaignData[] = [
  { name: "Norsk Folkehjelp", value: 8 },
  { name: "Standard OMS", value: 5 },
  { name: "Maps Campaign", value: 3 },
];

const dummyConversion: ConversionData[] = [
  { name: "Samtaler", value: 120 },
  { name: "Kvalifisert", value: 90 },
  { name: "Tilbud", value: 60 },
  { name: "Bestillinger", value: 30 },
];

export async function fetchPerformance(): Promise<PerformanceData[]> {
  return new Promise((resolve) => setTimeout(() => resolve(dummyPerformance), 200));
}

export async function fetchCampaigns(): Promise<CampaignData[]> {
  return new Promise((resolve) => setTimeout(() => resolve(dummyCampaigns), 200));
}

export async function fetchConversion(): Promise<ConversionData[]> {
  return new Promise((resolve) => setTimeout(() => resolve(dummyConversion), 200));
} 