// The night's market: which cars come up for auction. Each one is a real slice of the Saudi market
// (not just a price band), with the budget that makes it fun.
import type { CarModel, Mix } from './types';

const PREMIUM = new Set([
  'Lexus', 'Mercedes-Benz', 'Mercedes-AMG', 'Mercedes-Maybach', 'BMW', 'Audi', 'Porsche', 'Land Rover', 'Cadillac', 'Lincoln',
  'Genesis', 'Infiniti', 'Maserati', 'Bentley', 'Rolls-Royce', 'Ferrari', 'Lamborghini', 'McLaren', 'Aston Martin', 'Lucid',
]);
const SUPERCAR = new Set(['Ferrari', 'Lamborghini', 'McLaren', 'Rolls-Royce', 'Bentley', 'Aston Martin', 'Bugatti', 'Pagani', 'Koenigsegg']);
const CHINESE = new Set(['Geely', 'Changan', 'Jetour', 'Haval', 'Chery', 'MG', 'BYD', 'Hongqi', 'GWM', 'BAW', 'FAW', 'Exeed', 'Tank', 'GAC', 'JAC', 'Dongfeng']);
const AMERICAN = new Set(['Ford', 'Chevrolet', 'GMC', 'Dodge', 'Cadillac', 'Lincoln', 'Jeep', 'RAM', 'Chrysler', 'Mercury', 'Tesla']);
const JAPANESE = new Set(['Toyota', 'Lexus', 'Nissan', 'Infiniti', 'Honda', 'Mazda', 'Mitsubishi', 'Isuzu', 'Suzuki', 'Subaru']);
const GERMAN = new Set(['Mercedes-Benz', 'Mercedes-AMG', 'Mercedes-Maybach', 'BMW', 'Audi', 'Porsche', 'Volkswagen', 'MINI']);
// the big body-on-frame family haulers Saudis call جموس and لاندات
const GIANTS = /Land Cruiser(?! 7[69])|Prado|Patrol|Tahoe|Yukon|Suburban|Expedition|Escalade|Navigator|LX\d|GX\d|G63|G500|G-Class|Range Rover|Defender|Sequoia|Armada|QX80|Cullinan|Urus|Bentayga|Tank 500|G700|H9|Fortuner|FJ|Wrangler|Bronco|4Runner/i;
const SPORTY = /Mustang|Camaro|Challenger|Charger|Corvette|GT-R|\bZ\b|370Z|Supra|\bM[2-8]\b|C63|E63|AMG GT|911|Cayman|Boxster|Raptor|TRX|Huracán|Huracan|Aventador|SF90|F8|Roma|812|F12|F355|360|458|488|California|Portofino|570|540C|600LT|720S|750S|MP4|Artura|Vantage|DB11|DB12|Vanquish|Virage|Continental GT|R8|RS ?\d/i;
// the cars that are a classic in Saudi eyes, even when they're not that old
const ICONS = /Crown Victoria|Grand Marquis|Caprice|Cressida|Patrol Safari|Land Cruiser 80|Land Cruiser 60|LS400|Hilux|Pickup \(Datsun\)|Sierra Classic|Suburban/i;

export interface Market {
  id: Mix;
  label: string;
  note: string;
  /** budget preset that fits this market (SAR per player) */
  budget: number;
  test: (m: CarModel) => boolean;
}

export const MARKETS: Market[] = [
  { id: 'balanced', label: 'متنوع', note: 'من كل السوق: شعبي وعائلي وفخم', budget: 1_500_000, test: () => true },
  {
    id: 'luxury', label: 'فخامة', note: 'لكزس ومرسيدس ورنج وبنتلي ورولز', budget: 5_000_000,
    // a luxury night is luxury cars worth the name — no tired old S-Class at 40 ألف
    test: (m) => (m.tier === 'luxury' || m.tier === 'exotic' || PREMIUM.has(m.makeEn)) && m.value >= 110_000,
  },
  {
    id: 'exotic', label: 'سوبر كار', note: 'فيراري ولمبرقيني ومكلارين ورولز', budget: 10_000_000,
    test: (m) => SUPERCAR.has(m.makeEn) || (m.tier === 'exotic' && m.value >= 400_000),
  },
  {
    id: 'giants', label: 'جموس ولاندات', note: 'لاندكروزر وباترول وتاهو ويوكن', budget: 1_500_000,
    test: (m) => m.body === 'suv' && GIANTS.test(m.modelEn) && m.value >= 15_000,
  },
  {
    id: 'sport', label: 'سبورت', note: 'موستنج وتشارجر وبورش وفيراري', budget: 5_000_000,
    test: (m) => m.makeEn !== 'Rolls-Royce' && m.body !== 'suv' && m.body !== 'van' &&
      (m.tier === 'sport' || SPORTY.test(m.modelEn) || (m.tier === 'exotic' && (m.body === 'coupe' || m.body === 'convertible'))),
  },
  {
    id: 'family', label: 'عائلي', note: 'سيدانات وجيبات للبيت', budget: 750_000,
    test: (m) => ['family', 'daily'].includes(m.tier) && ['sedan', 'suv', 'van', 'wagon', 'hatch'].includes(m.body) && m.value >= 15_000 && m.value <= 260_000,
  },
  {
    id: 'street', label: 'حراج شعبي', note: 'اقتصادي ومستعمل على قد الحال', budget: 300_000,
    test: (m) => (['junk', 'daily', 'family', 'work'].includes(m.tier) || m.value <= 45_000) && m.value <= 70_000 && !PREMIUM.has(m.makeEn),
  },
  {
    id: 'work', label: 'ونيتات وشغل', note: 'هايلكس وشاص وددسن وسييرا', budget: 750_000,
    test: (m) => m.body === 'pickup' || (m.tier === 'work' && m.body !== 'sedan'),
  },
  {
    id: 'classic', label: 'كلاسيك الطيبين', note: 'كابرس وكراون فكتوريا والقديم الحلو', budget: 300_000,
    test: (m) => m.year <= 2000 || (ICONS.test(m.modelEn) && m.year <= 2011 && m.value <= 120_000) || (m.tier === 'classic' && m.year <= 2010),
  },
  {
    id: 'japanese', label: 'ياباني', note: 'تويوتا ولكزس ونيسان وهوندا', budget: 1_500_000,
    test: (m) => JAPANESE.has(m.makeEn),
  },
  {
    id: 'american', label: 'أمريكي', note: 'جمس وتاهو وفورد ودودج', budget: 1_500_000,
    test: (m) => AMERICAN.has(m.makeEn),
  },
  {
    id: 'german', label: 'ألماني', note: 'مرسيدس وبي إم وبورش وأودي', budget: 3_000_000,
    test: (m) => GERMAN.has(m.makeEn),
  },
  {
    id: 'china', label: 'صيني جديد', note: 'جيلي وشانجان وجيتور وهافال', budget: 750_000,
    test: (m) => CHINESE.has(m.makeEn),
  },
];

export const MARKET_BY_ID: Record<string, Market> = Object.fromEntries(MARKETS.map((x) => [x.id, x]));

export function marketOf(id: string | undefined): Market {
  return MARKET_BY_ID[id ?? 'balanced'] ?? MARKETS[0];
}
