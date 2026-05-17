import { NextResponse } from 'next/server';
import { Area, norwegianCounties } from '@/types';

// Mock data for areas
const mockAreas: Area[] = [
  {
    id: '1',
    campaign_name: 'Sentrum Kampanje',
    fylke: 'Oslo',
    status: 'open',
    created_by: 'John Doe',
    created_at: '2025-05-15T10:30:00Z'
  },
  {
    id: '2',
    campaign_name: 'Forstad Utreach',
    fylke: 'Viken',
    status: 'closed',
    created_by: 'Jane Smith',
    created_at: '2025-05-10T14:45:00Z'
  },
  {
    id: '3',
    campaign_name: 'Bysentrum',
    fylke: 'Vestland',
    status: 'open',
    created_by: 'Mike Johnson',
    created_at: '2025-05-20T09:15:00Z'
  },
  {
    id: '4',
    campaign_name: 'Havneområdet',
    fylke: 'Vestland',
    status: 'open',
    created_by: 'Sarah Williams',
    created_at: '2025-05-22T11:20:00Z'
  },
  {
    id: '5',
    campaign_name: 'Industriområde',
    fylke: 'Rogaland',
    status: 'closed',
    created_by: 'Robert Brown',
    created_at: '2025-05-18T16:30:00Z'
  },
  {
    id: '6',
    campaign_name: 'Universitetsområde',
    fylke: 'Trøndelag',
    status: 'open',
    created_by: 'Emily Davis',
    created_at: '2025-05-25T13:45:00Z'
  },
  {
    id: '7',
    campaign_name: 'Kjøpesenter',
    fylke: 'Oslo',
    status: 'closed',
    created_by: 'David Wilson',
    created_at: '2025-05-12T10:00:00Z'
  },
  {
    id: '8',
    campaign_name: 'Boligområde',
    fylke: 'Innlandet',
    status: 'open',
    created_by: 'Lisa Martinez',
    created_at: '2025-05-28T09:30:00Z'
  },
  {
    id: '9',
    campaign_name: 'Parksone',
    fylke: 'Agder',
    status: 'open',
    created_by: 'Thomas Anderson',
    created_at: '2025-05-30T14:15:00Z'
  },
  {
    id: '10',
    campaign_name: 'Strandfront',
    fylke: 'Møre og Romsdal',
    status: 'closed',
    created_by: 'Jennifer Taylor',
    created_at: '2025-05-05T11:45:00Z'
  },
  {
    id: '11',
    campaign_name: 'Fjellområde',
    fylke: 'Troms og Finnmark',
    status: 'open',
    created_by: 'Daniel Moore',
    created_at: '2025-06-01T10:20:00Z'
  },
  {
    id: '12',
    campaign_name: 'Innsjødistrikt',
    fylke: 'Nordland',
    status: 'closed',
    created_by: 'Amanda Clark',
    created_at: '2025-05-29T15:30:00Z'
  },
  {
    id: '13',
    campaign_name: 'Kystområde Nord',
    fylke: 'Nordland',
    status: 'open',
    created_by: 'Erik Hansen',
    created_at: '2025-05-27T13:20:00Z'
  },
  {
    id: '14',
    campaign_name: 'Sentrum Sør',
    fylke: 'Agder',
    status: 'closed',
    created_by: 'Maria Olsen',
    created_at: '2025-05-26T09:15:00Z'
  },
  {
    id: '15',
    campaign_name: 'Vestlig Distrikt',
    fylke: 'Vestfold og Telemark',
    status: 'open',
    created_by: 'Anders Johansen',
    created_at: '2025-05-24T14:30:00Z'
  },
  {
    id: '16',
    campaign_name: 'Østlig Område',
    fylke: 'Viken',
    status: 'open',
    created_by: 'Kari Pedersen',
    created_at: '2025-05-23T11:45:00Z'
  }
];

// GET handler for fetching all areas
export async function GET() {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return NextResponse.json(mockAreas);
}
