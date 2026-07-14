/**
 * AES Catalog — single source of truth for branding & marketing content
 * pulled directly from arialengineering.com.
 *
 * Ported verbatim from ../../aes-frontend/src/lib/aesCatalog.js.
 * Image URLs are referenced live (no local copies).
 */
import type { AcType, PropertyType } from '../types/api';

const PIC = 'https://www.arialengineering.com/pictures';

// ─── Building / property types ─────────────────────────────────────────────
// The first question on the installation flow + on property creation. Mirrors
// the six AES "type of space" categories with the icons used on the site.
export interface BuildingType {
  value: PropertyType;
  label: string;
  description: string;
  image: string;
}

export const BUILDING_TYPES: BuildingType[] = [
  {
    value: 'RESIDENTIAL',
    label: 'Residential',
    description: 'Apartments, villas, individual homes',
    image: `${PIC}/residential.png`,
  },
  {
    value: 'COMMERCIAL',
    label: 'Commercial / Office',
    description: 'Offices, IT parks, showrooms, retail',
    image: `${PIC}/commercial.png`,
  },
  {
    value: 'INDUSTRIAL',
    label: 'Industrial',
    description: 'Manufacturing units, warehouses, plants',
    image: `${PIC}/industrial.png`,
  },
  {
    value: 'HOSPITAL',
    label: 'Hospital / Pharma / Lab',
    description: 'Clinics, hospitals, laboratories, pharma',
    image: `${PIC}/hospitals.jpg`,
  },
  {
    value: 'HOTEL',
    label: 'Hotel / Restaurant',
    description: 'Hotels, resorts, restaurants, banquets',
    image: `${PIC}/it.png`,
  },
  {
    value: 'INSTITUTIONAL',
    label: 'Educational / Institutional',
    description: 'Schools, colleges, training centres',
    image: `${PIC}/retail.png`,
  },
];

export const buildingTypeMeta = (value: string): BuildingType | undefined =>
  BUILDING_TYPES.find((b) => b.value === value);

// ─── Brand partners ────────────────────────────────────────────────────────
export interface AesBrand {
  name: string;
  logo: string;
}

export const AES_BRANDS: AesBrand[] = [
  { name: 'Mitsubishi Electric', logo: `${PIC}/Mitsubishi-Electric.png` },
  { name: 'LG', logo: `${PIC}/brand2.png` },
  { name: 'Hisense / Toshiba', logo: `${PIC}/hisense.png` },
  { name: 'Hitachi', logo: `${PIC}/brand3.png` },
  { name: "O'General", logo: `${PIC}/brand5.png` },
];

/**
 * Brand → logo URL lookup for the install wizard's brand picker. Only the
 * five brands AES is an authorised dealer for ship logos sourced from
 * arialengineering.com. The rest fall back to a clean wordmark tile in the
 * UI so we never have to host any image locally.
 */
export const BRAND_LOGOS: Record<string, string> = {
  'Mitsubishi Electric': `${PIC}/Mitsubishi-Electric.png`,
  LG: `${PIC}/brand2.png`,
  Hisense: `${PIC}/hisense.png`,
  Toshiba: `${PIC}/hisense.png`,
  Hitachi: `${PIC}/brand3.png`,
  "O'General": `${PIC}/brand5.png`,
};

// ─── Product families (gallery) ────────────────────────────────────────────
// Each family powers one card on /services/products. Photos array holds the
// variant images the gallery cycles through.
export interface ProductFamilyMedia {
  label: string;
  image: string;
}

export interface ProductFamily {
  slug: string;
  name: string;
  tagline: string;
  cover: string;
  background?: string;
  photos: string[];
  indoorUnits?: ProductFamilyMedia[];
  accessories?: ProductFamilyMedia[];
  variants?: ProductFamilyMedia[];
  bestFor: string[];
}

export const PRODUCT_FAMILIES: ProductFamily[] = [
  {
    slug: 'vrf',
    name: 'VRF / VRV Systems',
    tagline: 'Multi-zone variable-refrigerant systems for premium projects.',
    cover: `${PIC}/products/vrf-product.png`,
    background: `${PIC}/products/vrf-bg.jpg`,
    photos: [
      `${PIC}/products/vrf1.jpg`,
      `${PIC}/products/vrf2.jpg`,
      `${PIC}/products/vrf3.jpg`,
      `${PIC}/products/vrf4.jpg`,
      `${PIC}/products/vrf5.jpg`,
    ],
    indoorUnits: [
      { label: 'VRF Cassette', image: `${PIC}/products/vrf-cassette1.png` },
      { label: 'Compact Cassette', image: `${PIC}/products/vrf-cassette4.png` },
      { label: 'Ducted', image: `${PIC}/products/vrf-duct.png` },
      { label: 'High-wall Split', image: `${PIC}/products/vrf-split.png` },
    ],
    bestFor: ['Commercial', 'Industrial', 'Hospitality', 'Institutional'],
  },
  {
    slug: 'chiller',
    name: 'Chiller Systems',
    tagline: 'Air-cooled and water-cooled chillers with FCU + diffuser kits.',
    cover: `${PIC}/products/airchillers.png`,
    background: `${PIC}/products/chillers-bg.jpg`,
    photos: [
      `${PIC}/products/chiller1.jpg`,
      `${PIC}/products/chiller2.jpg`,
      `${PIC}/products/chiller3.jpg`,
      `${PIC}/products/chiller4.jpg`,
      `${PIC}/products/chiller5.jpg`,
      `${PIC}/products/waterchillers.png`,
    ],
    accessories: [
      { label: 'FCU', image: `${PIC}/products/chiller-fcu.png` },
      { label: 'Manifold', image: `${PIC}/products/chiller-mfd.png` },
      { label: 'Resistant', image: `${PIC}/products/chiller-resistant.png` },
      { label: 'Swirl Diffuser', image: `${PIC}/products/chiller-swirl.png` },
    ],
    bestFor: ['Industrial', 'Commercial', 'Hospital'],
  },
  {
    slug: 'ductable',
    name: "Ductable AC's",
    tagline: 'High-capacity ducted DX systems for halls, banquets, retail.',
    cover: `${PIC}/products/duct1.jpg`,
    photos: [
      `${PIC}/products/duct1.jpg`,
      `${PIC}/products/duct2.jpg`,
      `${PIC}/products/duct3.jpg`,
      `${PIC}/products/duct4.jpg`,
      `${PIC}/products/duct5.jpg`,
    ],
    bestFor: ['Commercial', 'Hospitality', 'Institutional'],
  },
  {
    slug: 'cassette',
    name: "Cassette AC's",
    tagline: 'Ceiling-mounted 4-way cassette units for offices and shops.',
    cover: `${PIC}/products/cassette1.jpg`,
    photos: [
      `${PIC}/products/cassette1.jpg`,
      `${PIC}/products/cassette2.jpg`,
      `${PIC}/products/cassette3.jpg`,
      `${PIC}/products/cassette4.jpg`,
    ],
    bestFor: ['Commercial', 'Hospital', 'Institutional'],
  },
  {
    slug: 'split',
    name: 'Split & Tower AC',
    tagline: 'High-wall splits and free-standing tower units (0.8–4.0 TR).',
    cover: `${PIC}/products/split1.jpg`,
    photos: [
      `${PIC}/products/split1.jpg`,
      `${PIC}/products/split2.jpg`,
      `${PIC}/products/split3.jpg`,
      `${PIC}/products/split4.jpg`,
      `${PIC}/products/split5.jpg`,
    ],
    bestFor: ['Residential', 'Commercial'],
  },
  {
    slug: 'ahu',
    name: 'Air Handling Units',
    tagline: 'Tailored AHUs for fresh-air, treated-air and hygienic zones.',
    cover: `${PIC}/products/ahu.png`,
    background: `${PIC}/products/ahu-bg.jpg`,
    photos: [
      `${PIC}/products/ahu1.png`,
      `${PIC}/products/ahu2.png`,
      `${PIC}/products/ahu3.png`,
      `${PIC}/products/ahu4.png`,
      `${PIC}/products/ahu5.png`,
    ],
    bestFor: ['Industrial', 'Hospital', 'Institutional'],
  },
  {
    slug: 'ventilation',
    name: 'Ventilation Systems',
    tagline: 'Bathroom, kitchen, parking and exhaust ventilation packages.',
    cover: `${PIC}/products/vent1.jpg`,
    background: `${PIC}/products/ventilation-bg.jpg`,
    photos: [
      `${PIC}/products/vent1.jpg`,
      `${PIC}/products/vent2.jpg`,
      `${PIC}/products/vent3.jpg`,
      `${PIC}/products/vent4.jpg`,
      `${PIC}/products/vent5.jpg`,
    ],
    variants: [
      { label: 'Bathroom', image: `${PIC}/products/vent-bath.png` },
      { label: 'Kitchen', image: `${PIC}/products/vent-kitchen.png` },
      { label: 'Parking', image: `${PIC}/products/vent-parking.png` },
      { label: 'Exhaust', image: `${PIC}/products/vent-exhaust.png` },
    ],
    bestFor: ['Residential', 'Commercial', 'Industrial', 'Hospitality'],
  },
  {
    slug: 'diffusers',
    name: 'Air Distribution',
    tagline: 'Square, round, linear, jet and swirl diffusers.',
    cover: `${PIC}/products/cdiffuser.png`,
    photos: [
      `${PIC}/products/diffuser1.jpg`,
      `${PIC}/products/diffuser2.jpg`,
      `${PIC}/products/diffuser3.jpg`,
      `${PIC}/products/diffuser4.jpg`,
      `${PIC}/products/diffuser5.jpg`,
    ],
    variants: [
      { label: 'Square Ceiling', image: `${PIC}/products/cdiffuser.png` },
      { label: 'Round', image: `${PIC}/products/rdiffuser.png` },
      { label: 'Linear', image: `${PIC}/products/ldiffuser.png` },
      { label: 'Jet / Eye', image: `${PIC}/products/eyediffuser.png` },
    ],
    bestFor: ['Commercial', 'Hospitality', 'Institutional'],
  },
];

// ─── AC type → product image (for installation / ticket flows) ─────────────
export const AC_TYPE_IMAGES: Record<AcType, string> = {
  SPLIT: `${PIC}/products/split1.jpg`,
  CASSETTE: `${PIC}/products/cassette1.jpg`,
  CENTRAL: `${PIC}/products/duct1.jpg`,
  VRF_VRV: `${PIC}/products/vrf-product.png`,
  WINDOW: `${PIC}/products/split3.jpg`,
  PORTABLE: `${PIC}/products/split4.jpg`,
};

// ─── Project portfolio (social proof) ──────────────────────────────────────
export interface AesProject {
  name: string;
  city: string;
  category: PropertyType;
  image: string;
}

export const AES_PROJECTS: AesProject[] = [
  // Residential
  { name: 'DSR The First', city: 'Hyderabad', category: 'RESIDENTIAL', image: `${PIC}/projectdsr.jpg` },
  { name: 'Royal One', city: 'Hyderabad', category: 'RESIDENTIAL', image: `${PIC}/projectroyalone.jpg` },
  { name: 'Cyprus Palms', city: 'Hyderabad', category: 'RESIDENTIAL', image: `${PIC}/projectcyprus.jpg` },
  { name: 'DSR Infrastructure', city: 'Hyderabad', category: 'RESIDENTIAL', image: `${PIC}/projectdsrinfra.jpg` },
  { name: 'Skypx Lake View', city: 'Hyderabad', category: 'RESIDENTIAL', image: `${PIC}/projectskypx.jpg` },
  { name: 'Prime Gardenia', city: 'Hyderabad', category: 'RESIDENTIAL', image: `${PIC}/projectprimegardenia.jpg` },
  { name: 'DSR Waterscape', city: 'Bangalore', category: 'RESIDENTIAL', image: `${PIC}/projectdsrwaterscape.jpg` },
  { name: 'Krinss Villas', city: 'Hyderabad', category: 'RESIDENTIAL', image: `${PIC}/projectkrinss.jpg` },
  { name: 'Esmeralda Fortune', city: 'Hyderabad', category: 'RESIDENTIAL', image: `${PIC}/projectesmeralda.jpg` },
  { name: 'DSR White Waters', city: 'Bangalore', category: 'RESIDENTIAL', image: `${PIC}/projectdsrwhitewaters.jpg` },
  { name: 'Bungalow', city: 'Hyderabad', category: 'RESIDENTIAL', image: `${PIC}/projectbungalow.jpg` },
  { name: 'Lotus Roldana', city: 'Hyderabad', category: 'RESIDENTIAL', image: `${PIC}/projectlotus.jpg` },
  // Commercial / Offices
  { name: 'Cyber Gateway', city: 'Hyderabad', category: 'COMMERCIAL', image: `${PIC}/projectcyber.jpg` },
  { name: 'Eco Space', city: 'Bangalore', category: 'COMMERCIAL', image: `${PIC}/projecteco.jpg` },
  { name: 'Signature Towers', city: 'Hyderabad', category: 'COMMERCIAL', image: `${PIC}/projectsign.jpg` },
  { name: 'Forum Sujana Mall', city: 'Hyderabad', category: 'COMMERCIAL', image: `${PIC}/projectforum.jpg` },
  { name: 'E Value Serve', city: 'Bangalore', category: 'COMMERCIAL', image: `${PIC}/projectevs.jpg` },
  { name: 'iSprout', city: 'Hyderabad', category: 'COMMERCIAL', image: `${PIC}/projectisprout.jpg` },
  { name: 'The Platina', city: 'Hyderabad', category: 'COMMERCIAL', image: `${PIC}/projectplatina.jpg` },
  { name: 'Max Shopping Mall', city: 'Vizag', category: 'COMMERCIAL', image: `${PIC}/projectmax.jpg` },
  { name: 'Halo Energie', city: 'Hyderabad', category: 'COMMERCIAL', image: `${PIC}/projecthalo.jpg` },
  { name: 'Akshara Office', city: 'Warangal', category: 'COMMERCIAL', image: `${PIC}/projectakshara.jpg` },
  { name: 'Greenko', city: 'Bangalore', category: 'COMMERCIAL', image: `${PIC}/projectgreenko.jpg` },
  { name: 'Anutex Shopping Mall', city: 'Hyderabad', category: 'COMMERCIAL', image: `${PIC}/projectanutex.jpg` },
  { name: 'Amoda', city: 'Hyderabad', category: 'COMMERCIAL', image: `${PIC}/projectamoda.jpg` },
  { name: 'Accenture', city: 'Hyderabad', category: 'COMMERCIAL', image: `${PIC}/projectaccenture.jpg` },
  { name: 'Nexa Showroom', city: 'Karimnagar', category: 'COMMERCIAL', image: `${PIC}/projectnexa.jpg` },
  // Hospitals & Pharma
  { name: 'Nu Cosmetic Clinic', city: 'Hyderabad', category: 'HOSPITAL', image: `${PIC}/projectnu.jpg` },
  { name: 'Santharam Hospital', city: 'Madanapalle', category: 'HOSPITAL', image: `${PIC}/projectsantharam.jpg` },
  { name: 'Vimta Labs', city: 'Bangalore', category: 'HOSPITAL', image: `${PIC}/projectvimta.jpg` },
  { name: 'Adarsha Hospital', city: 'Karimnagar', category: 'HOSPITAL', image: `${PIC}/projectadarsha.jpg` },
  { name: 'Shodhana Laboratories', city: 'Hyderabad', category: 'HOSPITAL', image: `${PIC}/projectshodana.jpg` },
  { name: 'Sri Sri Holistic', city: 'Hyderabad', category: 'HOSPITAL', image: `${PIC}/projectsri.jpg` },
  { name: 'Optimus Pharma', city: 'Hyderabad', category: 'HOSPITAL', image: `${PIC}/projectoptimus.jpg` },
  { name: 'Suraksha Hospital', city: 'Hyderabad', category: 'HOSPITAL', image: `${PIC}/projectsuraksha.jpg` },
  // Hospitality
  { name: 'Hotel Sarene', city: 'Tirupati', category: 'HOTEL', image: `${PIC}/projectsarene.jpg` },
  { name: 'Tabla Restaurant', city: 'Bangalore', category: 'HOTEL', image: `${PIC}/projecttabla.jpg` },
  { name: 'Tales Over Spirits', city: 'Hyderabad', category: 'HOTEL', image: `${PIC}/projecttcs.jpg` },
  { name: 'Prost Brew Pub', city: 'Hyderabad', category: 'HOTEL', image: `${PIC}/projectprost.jpg` },
  { name: 'Citrus Hotels', city: 'Bangalore', category: 'HOTEL', image: `${PIC}/projectcitrus.jpg` },
  { name: 'Paradise Restaurant', city: 'Hyderabad', category: 'HOTEL', image: `${PIC}/projectparadise.jpg` },
  { name: 'The Rig Pub', city: 'Bangalore', category: 'HOTEL', image: `${PIC}/projectrig.jpg` },
  { name: 'Iscon Club Resort', city: 'Gujarat', category: 'HOTEL', image: `${PIC}/projectiscon.jpg` },
  { name: 'Blue Tree Restaurant', city: 'Hyderabad', category: 'HOTEL', image: `${PIC}/projectbluetree.jpg` },
  { name: "Hotel Sandy's Tower", city: 'Bhubaneswar', category: 'HOTEL', image: `${PIC}/projectsandy.jpg` },
  { name: 'The PGS Vedanta', city: 'Kerala', category: 'HOTEL', image: `${PIC}/projectpgs.jpg` },
  // Educational
  { name: 'Koenig', city: 'Goa', category: 'INSTITUTIONAL', image: `${PIC}/projectkoenig.jpg` },
  { name: 'Delhi Public School', city: 'Karimnagar', category: 'INSTITUTIONAL', image: `${PIC}/projectdps.jpg` },
  { name: 'Alphores School', city: 'Karimnagar', category: 'INSTITUTIONAL', image: `${PIC}/projectalphores.jpg` },
  { name: 'CBIT & VBIT College', city: 'Proddatur', category: 'INSTITUTIONAL', image: `${PIC}/projectcbit.jpg` },
  { name: 'Open Minds School', city: 'Hyderabad', category: 'INSTITUTIONAL', image: `${PIC}/projectoms.jpg` },
  { name: 'Prachin Global School', city: 'Hyderabad', category: 'INSTITUTIONAL', image: `${PIC}/projectprachin.jpg` },
];

// ─── Misc shared assets ────────────────────────────────────────────────────
export const AES_LOGO = `${PIC}/logo-arial.png`;

export interface HeroSlide {
  src: string;
  label: string;
}

export const AES_HERO_SLIDES: HeroSlide[] = [
  { src: `${PIC}/slide1.jpg`, label: 'Showcase' },
  { src: `${PIC}/slide2.jpg`, label: 'VRF System' },
  { src: `${PIC}/slide3.jpg`, label: 'Water Chilled' },
  { src: `${PIC}/slide4.jpg`, label: 'Air Chilled' },
  { src: `${PIC}/slide5.jpg`, label: 'DX System' },
  { src: `${PIC}/slide6.jpg`, label: 'Ventilation' },
  { src: `${PIC}/slide7.jpg`, label: 'Air Handling Unit' },
];

export interface AesBranch {
  name: string;
  address: string;
  image: string;
}

export const AES_BRANCHES: AesBranch[] = [
  { name: 'Hyderabad', address: 'B-41, Vamika Arcade, Madhura Nagar, Hyderabad', image: `${PIC}/branch1.jpg` },
  { name: 'Tirupati', address: 'Tirupati, Andhra Pradesh', image: `${PIC}/branch2.jpg` },
  { name: 'Bangalore', address: 'Wilson Garden, Hosur Road, Bangalore', image: `${PIC}/branch3.jpg` },
  { name: 'Goa', address: 'Alto Porvorim, Bardez, Goa', image: `${PIC}/branch4.jpg` },
];

export const AES_CONTACT = {
  phones: ['+91 040 6613 1555', '+91 70938 78083', '+91 94576 35555'],
  email: 'info@arialengineering.com',
  hours: 'Mon–Sat 9:30 AM – 7 PM',
  website: 'https://www.arialengineering.com/',
};

// ─── AC type catalog with rich metadata for the install / ticket flows ────
export interface AesAcType {
  value: AcType;
  label: string;
  description: string;
  range: string;
  image: string;
  bestFor: string[];
}

export const AES_AC_TYPES: AesAcType[] = [
  {
    value: 'SPLIT',
    label: 'Split AC',
    description: 'High-wall split — best for individual rooms.',
    range: '0.8 – 2.0 TR',
    image: AC_TYPE_IMAGES.SPLIT,
    bestFor: ['RESIDENTIAL', 'COMMERCIAL'],
  },
  {
    value: 'CASSETTE',
    label: 'Cassette AC',
    description: '4-way ceiling cassette — even cooling for halls.',
    range: '1.5 – 4.0 TR',
    image: AC_TYPE_IMAGES.CASSETTE,
    bestFor: ['COMMERCIAL', 'HOSPITAL', 'HOTEL', 'INSTITUTIONAL'],
  },
  {
    value: 'CENTRAL',
    label: 'Ductable AC',
    description: 'High-static ductable for whole-floor / hall coverage.',
    range: '3.0 – 11 TR',
    image: AC_TYPE_IMAGES.CENTRAL,
    bestFor: ['COMMERCIAL', 'INDUSTRIAL', 'HOTEL', 'INSTITUTIONAL'],
  },
  {
    value: 'VRF_VRV',
    label: 'VRF / VRV',
    description: 'Variable-refrigerant multi-zone — premium projects.',
    range: '8 – 40 HP outdoor',
    image: AC_TYPE_IMAGES.VRF_VRV,
    bestFor: ['COMMERCIAL', 'INDUSTRIAL', 'HOTEL', 'INSTITUTIONAL', 'RESIDENTIAL'],
  },
  {
    value: 'WINDOW',
    label: 'Window AC',
    description: 'Single-block window unit for compact rooms.',
    range: '0.75 – 2.0 TR',
    image: AC_TYPE_IMAGES.WINDOW,
    bestFor: ['RESIDENTIAL'],
  },
  {
    value: 'PORTABLE',
    label: 'Portable AC',
    description: 'Movable plug-and-play unit for temporary cooling.',
    range: '1.0 – 1.5 TR',
    image: AC_TYPE_IMAGES.PORTABLE,
    bestFor: ['RESIDENTIAL'],
  },
];
