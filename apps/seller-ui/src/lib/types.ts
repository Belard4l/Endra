export type Img = { fileId: string; url: string };
export type OptionChoice = { id: string; label: string; priceDelta: number };
export type OptionGroup = { id: string; name: string; type: "single" | "multiple"; required: boolean; choices: OptionChoice[] };
export type ShopLite = { id: string; name: string; district?: string | null; avatar?: Img | null; ratings?: number };

export type ServiceCardData = {
  id: string;
  title: string;
  slug: string;
  category: string;
  shortDescription: string;
  images: Img[];
  basePrice: number;
  priceUnit: string;
  serviceArea: string[];
  ratings: number;
  reviewCount: number;
  bookingsCount?: number;
  sellerId: string;
  shopId: string;
  shop?: ShopLite | null;
  reasons?: string[];
};

export type Service = ServiceCardData & {
  description: string;
  optionGroups: OptionGroup[];
  durationHours?: number | null;
  travelFee: number;
  included: string[];
  excluded: string[];
  requirements: string;
  culturalOptions?: string | null;
  extraTerms?: string | null;
  tags: string[];
};

export type Category = { id: string; slug: string; name: string; nameRw?: string | null; icon?: string | null };
