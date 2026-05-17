// Subscription Tiers Configuration

export type SubscriptionTier = 'free' | 'premium';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending';
export type PaymentMethod = 'espees';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface SubscriptionFeatures {
  maxMembers: number;
  audioLab: boolean;
  rehearsals: boolean;
  customSongs: boolean;
  analytics: boolean;
  aiTranslation: boolean;
}

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  price: {
    monthly: number;
    yearly: number;
  };
  features: SubscriptionFeatures;
  description: string;
  popular?: boolean;
}

export interface PaymentRequest {
  id: string;
  zoneId: string;
  zoneName: string;
  coordinatorName: string;
  coordinatorEmail: string;
  amount: number;
  duration: 'monthly' | 'yearly';
  proofImageUrl: string;
  status: PaymentStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  approvedDuration?: number; // in months
  notes?: string;
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    tier: 'free',
    name: 'Free',
    price: {
      monthly: 0,
      yearly: 0
    },
    features: {
      maxMembers: -1,
      audioLab: false,
      rehearsals: false,
      customSongs: false,
      analytics: false,
      aiTranslation: true
    },
    description: 'Perfect for small groups getting started'
  },
  premium: {
    tier: 'premium',
    name: 'Premium',
    price: {
      monthly: 100,   // 1 Espee (100 KOBE) per month
      yearly: 1200    // 12 Espees (1200 KOBE) per year
    },
    features: {
      maxMembers: -1, // -1 means unlimited members
      audioLab: true,
      rehearsals: true,
      customSongs: true,
      analytics: true,
      aiTranslation: true
    },
    description: 'Unlimited members and full access',
    popular: true
  }
};

// KingsPay Goods & Services Configuration
export const KINGSPAY_CONFIG = {
  apiUrl: 'https://api.kingspay-gs.com/api/payment',
  paymentUrl: 'https://kingspay-gs.com/payment',
  currency: 'ESP', // Espees
  paymentType: 'espees',
  merchantName: 'LoveWorld Singers Rehearsal Hub',
  clientId: '9efd7695-d7cd-454c-8dd1-5467dfc773c2' // Test Client ID
};

// Espees Payment Configuration
export const ESPEES_CONFIG = {
  code: 'LWSRHP',
  name: 'Espees',
  description: 'LoveWorld Singers Rehearsal Hub Payment',
  currency: 'ESP',
  symbol: 'E',
  instructions: [
    'Click "Pay with KingsPay" button below',
    'You will be redirected to KingsPay Goods & Services',
    'Complete the payment using your Espees account',
    'You will be redirected back after payment',
    'Your subscription will be activated automatically'
  ]
};

// Feature descriptions
export const FEATURE_DESCRIPTIONS = {
  maxMembers: 'Maximum number of members in your zone',
  audioLab: 'Access to AudioLab for song practice',
  rehearsals: 'Track rehearsal attendance and progress',
  customSongs: 'Create and manage your own songs',
  analytics: 'View detailed analytics and reports',
  aiTranslation: 'AI-powered lyrics translation'
};

// Helper function to display member limit
export function displayMemberLimit(tier: SubscriptionTier): string {
  const limit = SUBSCRIPTION_PLANS[tier].features.maxMembers;
  return limit === -1 ? 'Unlimited' : limit.toString();
}

// Helper function to format price in Espees
export function formatPrice(amount: number): string {
  const espees = amount / 100; // Convert KOBE to Espees
  return `${espees.toFixed(espees % 1 === 0 ? 0 : 2)} ${ESPEES_CONFIG.symbol}`;
}

// Helper function to calculate savings for yearly plan
export function calculateYearlySavings(): number {
  const monthlyTotal = SUBSCRIPTION_PLANS.premium.price.monthly * 12;
  const yearlyPrice = SUBSCRIPTION_PLANS.premium.price.yearly;
  return monthlyTotal - yearlyPrice;
}

// Helper function to format Espees amount for display
export function formatEspeesAmount(kobeAmount: number): string {
  return `${(kobeAmount / 100).toFixed(2)} ${ESPEES_CONFIG.symbol}`;
}

// Helper function to check if feature is available
export function hasFeatureAccess(
  tier: SubscriptionTier,
  feature: keyof SubscriptionFeatures
): boolean {
  return SUBSCRIPTION_PLANS[tier].features[feature] as boolean;
}

// Helper function to get member limit
export function getMemberLimit(tier: SubscriptionTier): number {
  const limit = SUBSCRIPTION_PLANS[tier].features.maxMembers;
  return limit === -1 ? Infinity : limit; // -1 becomes unlimited (Infinity)
}
