/** Konum gösterimi: İlçe, İl formatı */
export function formatLocationDisplay(p: {
  district?: string | null;
  city?: string | null;
  country?: string | null;
}): string {
  const { district, city, country } = p;
  if (district && city) return `${district}, ${city}`;
  if (district) return district;
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  return '';
}
