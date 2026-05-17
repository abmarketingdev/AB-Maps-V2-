export type RapportRecord = {
  client: string;
  campaign: string;
  agent: string;
  o1: number;
  o2: number;
  o3: number;
  smsPr: number;
  con: number;
  trans: number;
  conver: number;
  s: number;
  y1: number;
  y2: number;
  y3: number;
  y4: number;
  y5: number;
  y6: number;
};

const dummyRapport: RapportRecord[] = [
  {
    client: "Blå Kors",
    campaign: "BK - Blå Kors",
    agent: "abm_casper1",
    o1: 0,
    o2: 0,
    o3: 0,
    smsPr: 0,
    con: 0,
    trans: 0,
    conver: 20,
    s: 56,
    y1: 0,
    y2: 0.0,
    y3: 0.0,
    y4: 0.0,
    y5: 0.0,
    y6: 0.0,
  },
  {
    client: "Nasjonalforeningen",
    campaign: "NFFH - Nasjonalforeningen",
    agent: "abm_Alex",
    o1: 5,
    o2: 0,
    o3: 0,
    smsPr: 0,
    con: 0,
    trans: 0,
    conver: 50,
    s: 135,
    y1: 10,
    y2: 0.0,
    y3: 0.0,
    y4: 0.0,
    y5: 0.0,
    y6: 0.0,
  },
];

export async function fetchRapport(): Promise<RapportRecord[]> {
  return new Promise((resolve) => setTimeout(() => resolve(dummyRapport), 200));
} 