export const agencyBillingPlan = {
  creditBalance: 18400,
  currentPlan: "Starter",
  currentPrice: "$7,500/month",
  includedCredit: "$1,000/month credits included",
  influencerAllowance: 2,
  parallelGenerationsPerUser: 8,
  employeeAllowance: 4,
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
    note: "Open more campaign lanes with double the current creator capacity and faster generation throughput.",
    supportLabel: "Standard support",
    featureHighlights: ["4 AI influencer capacity", "12 parallel generations per user", "More prompt testing flexibility", "Scale-ready agency workspace"],
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
    note: "Run more briefs, campaign variants, and creator experiments at the same time without slowing the team down.",
    supportLabel: "Priority support queue",
    featureHighlights: ["6 AI influencer capacity", "16 parallel generations per user", "Higher campaign output", "Advanced workflow flexibility"],
  },
  {
    id: "ten-influencers",
    label: "10 AI influencers",
    badge: "Scale tier",
    ctaLabel: "Upgrade to 10",
    price: "$25,000/month",
    includedCredit: "$5,000/month credits included",
    parallelGenerationsPerUser: 24,
    note: "Scale your custom workflows with hosted scale-tier infrastructure and tailored solutions built around your needs.",
    supportLabel: "Priority launch support",
    featureHighlights: ["10 AI influencer capacity", "24 parallel generations per user", "Hosted scale-tier infrastructure", "Advanced generation capabilities"],
  },
  {
    id: "enterprise",
    label: "Contact Us",
    badge: "Enterprise",
    ctaLabel: "Contact sales",
    price: "Custom",
    note: "Design a custom agency program around complex creator operations, bespoke volume, governance, and dedicated success needs.",
    supportLabel: "Dedicated support",
    featureHighlights: ["Custom AI influencer capacity", "Tailored workflow design", "Advanced capability access", "Dedicated success support"],
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
