// Districts data for Norwegian counties
// Currently only includes Oslo districts, can be expanded for other counties

export const norwegianDistricts: Record<string, string[]> = {
  'Oslo': [
    'Alna',
    'Bjerke',
    'Frogner',
    'Gamle Oslo',
    'Grorud',
    'Grünerløkka',
    'Nordre Aker',
    'Nordstrand',
    'Sagene',
    'St. Hanshaugen',
    'Stovner',
    'Søndre Nordstrand',
    'Ullern',
    'Vestre Aker',
    'Østensjø'
  ],
  // Add other counties' districts as needed
};

// Helper function to get districts for a specific county
export const getDistrictsForCounty = (county: string): string[] => {
  return norwegianDistricts[county] || [];
};
