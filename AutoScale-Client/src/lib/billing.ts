import type { AgencyBillingSettings } from "../types";

export const defaultAgencyBillingSettings: AgencyBillingSettings = {
  monthlySubscriptionPrice: 7500,
  includedMonthlyCredits: 1000,
  aiInfluencerAllowance: 2,
  workspaceTabAllowance: 9,
  parallelRowGenerations: 8,
  teamSeatAllowance: 4,
};

export const agencyBillingPlan = {
  creditBalance: 18400,
  currentPlan: "Starter",
  currentPrice: "$7,500/month",
  includedCredit: "$1,000/month credits included",
  influencerAllowance: defaultAgencyBillingSettings.aiInfluencerAllowance,
  parallelGenerationsPerUser: defaultAgencyBillingSettings.parallelRowGenerations,
  employeeAllowance: defaultAgencyBillingSettings.teamSeatAllowance,
  dedicatedGpusPerEmployee: 1,
  renewalDate: "May 1, 2026",
};

export const upgradeOptions = [
  {
    id: "four-influencers",
    label: "4 AI influencers",
    badge: "Step up",
    ctaLabel: "Upgrade to 4",
    price: "$12,000/month",
    includedCredit: "$1,500/month credits included",
    parallelGenerationsPerUser: 12,
    note: "Add more creator capacity and request workflow support as your agency production needs grow.",
    supportLabel: "Standard support",
    featureHighlights: ["4 AI influencer capacity", "12 parallel row generations per user", "Workflow support options", "Scale-ready agency workspace"],
  },
  {
    id: "six-influencers",
    label: "6 AI influencers",
    badge: "Best value",
    ctaLabel: "Upgrade to 6",
    price: "$12,500/month",
    includedCredit: "$2,000/month credits included",
    parallelGenerationsPerUser: 16,
    featured: true,
    note: "Run more briefs, campaign variants, and creator experiments with room for custom workflow additions.",
    supportLabel: "Priority support queue",
    featureHighlights: ["6 AI influencer capacity", "16 parallel row generations per user", "Higher campaign output", "Custom workflow flexibility"],
  },
  {
    id: "ten-influencers",
    label: "10 AI influencers",
    badge: "Scale tier",
    ctaLabel: "Upgrade to 10",
    price: "$25,000/month",
    includedCredit: "$5,000/month credits included",
    parallelGenerationsPerUser: 24,
    note: "Scale custom workflows, features, models, and LoRAs with infrastructure planned around your agency needs.",
    supportLabel: "Priority launch support",
    featureHighlights: ["10 AI influencer capacity", "24 parallel row generations per user", "Custom models and LoRAs", "Faster GPU infrastructure options"],
  },
  {
    id: "enterprise",
    label: "Custom Plan",
    badge: "Enterprise",
    ctaLabel: "Request a follow-up",
    price: "Custom",
    note: "Tell us what you need and we will follow up with a plan for custom workflows, features, models, LoRAs, capacity, and implementation support.",
    supportLabel: "Dedicated support",
    featureHighlights: ["Custom AI influencer capacity", "Custom workflows and features", "Custom models and LoRAs", "Faster GPU infrastructure options"],
  },
];

export const creditPurchaseOptions = [
  { id: "credit-500", label: "$500 credits", amount: 500 },
  { id: "credit-1000", label: "$1,000 credits", amount: 1000 },
  { id: "credit-2500", label: "$2,500 credits", amount: 2500 },
];

export const paymentMethodOptions = [
  {
    id: "card",
    label: "Debit / credit card",
    description: "Instant test approval with major debit and credit cards.",
    discountRate: 0,
    discountLabel: "Standard processing",
    settlementLabel: "Instant approval",
    detailLabel: "Card processor",
    detailValue: "Local test checkout",
    logoBadges: [
      { label: "VISA", className: "bg-[#1434cb] text-white" },
      { label: "MC", className: "bg-[#eb001b] text-white" },
      { label: "AMEX", className: "bg-[#2e77bb] text-white" },
      { label: "DEBIT", className: "bg-[color:var(--surface-card)] text-[color:var(--text-strong)]" },
    ],
  },
  {
    id: "bank",
    label: "Bank transfer",
    description: "Lower-cost wire or ACH transfer for larger agency top-ups.",
    discountRate: 0.02,
    discountLabel: "-2% discount",
    settlementLabel: "1-2 business days",
    detailLabel: "Transfer rails",
    detailValue: "ACH / Wire / SWIFT",
    logoBadges: [
      { label: "ACH", className: "bg-[#0f766e] text-white" },
      { label: "WIRE", className: "bg-[#155e75] text-white" },
      { label: "SWIFT", className: "bg-[#1d4ed8] text-white" },
      { label: "BANK", className: "bg-[color:var(--surface-card)] text-[color:var(--text-strong)]" },
    ],
  },
  {
    id: "crypto",
    label: "Crypto",
    description: "Pay with stablecoin or major crypto rails for the best discount.",
    discountRate: 0.05,
    discountLabel: "-5% discount",
    settlementLabel: "Network dependent",
    detailLabel: "Accepted assets",
    detailValue: "USDC / BTC / ETH",
    logoBadges: [
      { label: "USDC", className: "bg-[#2775ca] text-white" },
      { label: "BTC", className: "bg-[#f7931a] text-black" },
      { label: "ETH", className: "bg-[#627eea] text-white" },
      { label: "SOL", className: "bg-[#14f195] text-black" },
    ],
  },
];

export const planGlowStyle = {
  background:
    "radial-gradient(circle at top right, color-mix(in srgb, var(--accent-main) 28%, transparent) 0%, transparent 42%), linear-gradient(180deg, color-mix(in srgb, var(--accent-main) 10%, transparent) 0%, transparent 72%)",
};
