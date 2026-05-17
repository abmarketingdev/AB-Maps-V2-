export interface Area {
  id: string;
  campaign_name: string;
  fylke: string;
  bydel?: string; // New property for district information
  status: "open" | "closed";
  created_by: string;
  created_at: string; // ISO format
}

export type ViewMode = 'list' | 'map';

export const norwegianCounties = [
  'Agder',
  'Innlandet',
  'Møre og Romsdal',
  'Nordland',
  'Oslo',
  'Rogaland',
  'Troms og Finnmark',
  'Trøndelag',
  'Vestfold og Telemark',
  'Vestland',
  'Viken'
];
