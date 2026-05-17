export interface PricingTier {
  name: string
  pricePerMember: number
  discount: number
  minMembers: number
}

export const PRICING_TIERS: PricingTier[] = [
  { name: 'Standard', pricePerMember: 1, discount: 0, minMembers: 1 },
  { name: 'Bulk 100+', pricePerMember: 1, discount: 10, minMembers: 100 },
  { name: 'Bulk 200+', pricePerMember: 1, discount: 20, minMembers: 200 },
]

export const FREE_TIER_MEMBER_LIMIT = 10

export function calculateSubscriptionPrice(memberCount: number): {
  basePrice: number
  discount: number
  discountAmount: number
  finalPrice: number
  priceInKobe: number
  tier: PricingTier
} {
  const tier = [...PRICING_TIERS]
    .reverse()
    .find(t => memberCount >= t.minMembers) || PRICING_TIERS[0]

  const basePrice = memberCount * tier.pricePerMember
  const discountAmount = (basePrice * tier.discount) / 100
  const finalPrice = basePrice - discountAmount
  const priceInKobe = Math.round(finalPrice * 100)

  return { basePrice, discount: tier.discount, discountAmount, finalPrice, priceInKobe, tier }
}

export function calculateIndividualPrice(): { price: number; priceInKobe: number } {
  return { price: 1, priceInKobe: 100 }
}

export function isFreeTier(memberCount: number): boolean {
  return memberCount <= FREE_TIER_MEMBER_LIMIT
}

export function getPricingDisplay(memberCount: number): string {
  if (isFreeTier(memberCount)) return 'Free (up to 10 members)'

  const pricing = calculateSubscriptionPrice(memberCount)
  
  if (pricing.discount > 0) {
    return `${pricing.finalPrice} ESP (${pricing.discount}% discount applied)`
  }
  
  return `${pricing.finalPrice} ESP`
}
