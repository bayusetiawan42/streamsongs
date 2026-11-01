import { SettlementType, SettlementInfo } from '../types';

export const SETTLEMENT_DICTIONARY: Record<SettlementType, SettlementInfo> = {
  metropolis: {
    type: 'metropolis',
    label: 'Metropolis',
    icon: 'fa-city',
    description: 'Vibrant urban skyglow & towering skyline',
  },
  city: {
    type: 'city',
    label: 'Urban City',
    icon: 'fa-building',
    description: 'Warm ambient glow & modern rooftops',
  },
  town: {
    type: 'town',
    label: 'Quiet Town',
    icon: 'fa-house',
    description: 'Balanced twilight & serene horizon',
  },
  village: {
    type: 'village',
    label: 'Peaceful Village',
    icon: 'fa-tree',
    description: 'Pure starlight, fireflies & rolling hills',
  },
  highlands: {
    type: 'highlands',
    label: 'Highlands',
    icon: 'fa-mountain',
    description: 'Crisp alpine air, drifting mist & majestic ridges',
  },
};

export interface SettlementInput {
  population?: number;
  featureCode?: string;
  elevation?: number;
  name?: string;
}

export function classifySettlement(input: SettlementInput): SettlementType {
  const { population = 0, featureCode = '', elevation = 0 } = input;

  // 1. High elevation takes priority for mountain/alpine feel
  if (elevation >= 850) {
    return 'highlands';
  }

  // 2. Metropolis: Capital city (PPLC) or population >= 1.5 million
  if (featureCode === 'PPLC' || population >= 1_500_000) {
    return 'metropolis';
  }

  // 3. Urban City: Provincial/regional seat (PPLA, PPLA2) or population >= 150k
  if (featureCode.startsWith('PPLA') || population >= 150_000) {
    return 'city';
  }

  // 4. Quiet Town: Population 15k to 150k
  if (population >= 15_000) {
    return 'town';
  }

  // 5. Village: Small population, rural farm code, or default
  return 'village';
}

export interface ReverseGeocodeResult {
  placeName: string;
  country?: string;
  settlement: SettlementType;
  population?: number;
  elevation?: number;
  timezone?: string;
}

export async function reverseGeocodeGPS(lat: number, lon: number): Promise<ReverseGeocodeResult> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Reverse geocode failed');
    const data = await res.json();

    const placeName =
      data.city ||
      data.locality ||
      data.principalSubdivision ||
      data.countryName ||
      'Your location';

    const country = data.countryName || undefined;

    // Check if place is known as capital or has population indicators
    let estimatedPop = 50_000;
    const admin = data.localityInfo?.administrative || [];
    const isCapital = admin.some(
      (a: { description?: string; name?: string }) =>
        a.description?.toLowerCase().includes('capital') ||
        a.description?.toLowerCase().includes('largest city')
    );

    if (isCapital) {
      estimatedPop = 3_000_000;
    } else if (data.city && !data.locality) {
      estimatedPop = 500_000;
    } else if (data.locality && !data.city) {
      estimatedPop = 8_000;
    }

    const settlement = classifySettlement({
      population: estimatedPop,
      featureCode: isCapital ? 'PPLC' : undefined,
    });

    return {
      placeName,
      country,
      settlement,
      population: estimatedPop,
    };
  } catch (e) {
    console.warn('GPS reverse geocode fallback:', e);
    return {
      placeName: 'Your location',
      settlement: 'metropolis', // Default sensible fallback
    };
  }
}
