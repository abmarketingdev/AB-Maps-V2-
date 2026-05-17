export type TeamMember = {
  id: number;
  name: string;
  avatar: string;
  initials: string;
  team: string;
  sales: number;
  target: number;
  conversion: number;
  avgValue: number;
  trend: "up" | "down";
};

const dummyLeaderboard: TeamMember[] = [
  {
    id: 1,
    name: "Sofia Davis",
    avatar: "/placeholder.svg?height=40&width=40",
    initials: "SD",
    team: "NF - Oslo",
    sales: 42,
    target: 50,
    conversion: 28,
    avgValue: 1250,
    trend: "up",
  },
  {
    id: 2,
    name: "Alex Johnson",
    avatar: "/placeholder.svg?height=40&width=40",
    initials: "AJ",
    team: "NF - Oslo",
    sales: 38,
    target: 45,
    conversion: 25,
    avgValue: 1100,
    trend: "up",
  },
];

export async function fetchLeaderboard(): Promise<TeamMember[]> {
  return new Promise((resolve) => setTimeout(() => resolve(dummyLeaderboard), 200));
} 