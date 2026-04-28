import { useState } from "react";

import { agencyBillingPlan, creditPurchaseOptions, paymentMethodOptions, planGlowStyle } from "../lib/billing";
import { cx } from "../lib/cx";
import { theme } from "../styles/theme";
import type { UserRecord } from "../types";

interface AgencyBillingPageProps {
  currentUser: UserRecord;
}

type PaymentLogoBadge = (typeof paymentMethodOptions)[number]["logoBadges"][number];

const billingCountryOptions = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czechia",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];

const cryptoPaymentOptions = [
  { id: "bitcoin", label: "Bitcoin", symbol: "BTC", network: "Bitcoin" },
  { id: "eth", label: "Ethereum", symbol: "ETH", network: "Ethereum" },
  { id: "usdc", label: "USD Coin", symbol: "USDC", network: "Base" },
  { id: "usdt", label: "Tether", symbol: "USDT", network: "Ethereum / Tron" },
  { id: "sol", label: "Solana", symbol: "SOL", network: "Solana" },
];

function PaymentLogoStrip({ logos, compact = false }: { logos: PaymentLogoBadge[]; compact?: boolean }) {
  return (
    <div className={cx("flex flex-wrap", compact ? "gap-1.5" : "gap-2")}>
      {logos.map((logo) => (
        <span
          key={logo.label}
          className={cx(
            "inline-flex items-center justify-center rounded-lg border border-white/10 px-2 font-black tracking-[0.08em] shadow-[var(--shadow-soft)]",
            compact ? "h-7 min-w-11 text-[9px]" : "h-9 min-w-14 text-[10px]",
            logo.className,
          )}
        >
          {logo.label}
        </span>
      ))}
    </div>
  );
}

export function AgencyBillingPage({ currentUser }: AgencyBillingPageProps) {
  const [selectedCreditPurchaseId, setSelectedCreditPurchaseId] = useState(creditPurchaseOptions[1].id);
  const [customCreditAmount, setCustomCreditAmount] = useState("5000");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState(paymentMethodOptions[0].id);
  const [selectedCryptoPaymentId, setSelectedCryptoPaymentId] = useState(cryptoPaymentOptions[2].id);
  const [processorNotice, setProcessorNotice] = useState<string | null>(null);
  const selectedCreditPurchase = creditPurchaseOptions.find((option) => option.id === selectedCreditPurchaseId) || creditPurchaseOptions[0];
  const customCreditAmountValue = Math.max(0, Number(customCreditAmount) || 0);
  const selectedCreditAmount = selectedCreditPurchaseId === "custom" ? customCreditAmountValue : selectedCreditPurchase.amount;
  const selectedCreditLabel = selectedCreditPurchaseId === "custom" ? `$${selectedCreditAmount.toLocaleString()} custom credits` : selectedCreditPurchase.label;
  const selectedPaymentMethod = paymentMethodOptions.find((option) => option.id === selectedPaymentMethodId) || paymentMethodOptions[0];
  const selectedCryptoPayment = cryptoPaymentOptions.find((option) => option.id === selectedCryptoPaymentId) || cryptoPaymentOptions[2];
  const paymentDiscount = Math.round(selectedCreditAmount * selectedPaymentMethod.discountRate);
  const paymentTotal = Math.max(0, selectedCreditAmount - paymentDiscount);
  const projectedCreditBalance = agencyBillingPlan.creditBalance + selectedCreditAmount;
  const paymentActionLabel =
    selectedPaymentMethod.id === "bank"
      ? "Generate bank transfer test"
      : selectedPaymentMethod.id === "crypto"
        ? "Generate crypto payment test"
        : "Run local card test purchase";

  return (
    <div className="space-y-6">
      <section className={theme.cardStrong + " glass-panel rounded-[32px] p-6 sm:p-7"}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--text-muted)]">Billing</p>
            <h1 className="font-display mt-2 text-4xl text-[color:var(--text-strong)]">Agency plan and credits</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">
              {currentUser.agencyName || "Your agency"} currently has {agencyBillingPlan.creditBalance.toLocaleString()} credits available.
            </p>
          </div>

          <div className="rounded-[24px] border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-5 py-4 text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Credit balance</p>
            <p className="mt-2 text-3xl font-semibold text-[color:var(--text-strong)]">{agencyBillingPlan.creditBalance.toLocaleString()}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section
          className="billing-current-plan-card relative overflow-hidden rounded-[30px] border bg-[color:var(--surface-card-strong)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent-main)_42%,transparent),0_22px_70px_color-mix(in_srgb,var(--accent-main)_12%,transparent)]"
          style={{ borderColor: "color-mix(in srgb, var(--accent-main) 72%, transparent)" }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-70" style={planGlowStyle} />
          <div className="relative z-10 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Current Plan</p>
                <h2 className="font-display mt-3 text-4xl text-[color:var(--text-strong)]">{agencyBillingPlan.currentPlan}</h2>
              </div>
              <span className="rounded-full border border-[color:var(--border-strong)] bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--accent-text)]">
                Active
              </span>
            </div>

            <div className="mt-5 rounded-[24px] border border-[color:var(--border-strong)] bg-[color:var(--accent-soft)] px-4 py-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-text)]">Monthly subscription</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--text-strong)]">{agencyBillingPlan.currentPrice}</p>
                </div>
                <p className="max-w-32 text-right text-xs font-semibold leading-5 text-[color:var(--text-muted)]">
                  {agencyBillingPlan.includedCredit}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-2">
              <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3 xl:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Credit balance</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--text-strong)]">{agencyBillingPlan.creditBalance.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3 xl:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Renews</p>
                <p className="mt-2 text-sm font-semibold text-[color:var(--text-strong)]">{agencyBillingPlan.renewalDate}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3 sm:col-span-3 xl:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Plan allowance</p>
                  <span className="rounded-full bg-[color:var(--surface-soft)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--accent-text)]">
                    Starter
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--text-strong)]">
                  {agencyBillingPlan.influencerAllowance} AI influencers, {agencyBillingPlan.employeeAllowance} employees, and {agencyBillingPlan.parallelGenerationsPerUser} parallel generations per employee.
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-10 border-t border-[color:var(--surface-border)] bg-[color:var(--surface-card)] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Plan benefits</p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--text-strong)]">Capacity, tooling, and automation included</p>
              </div>
              <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--text-muted)]">
                Team capacity
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {[
                [
                  `${agencyBillingPlan.influencerAllowance}`,
                  "AI influencer allowance",
                  "Included AI influencer capacity on the Starter plan. The allowance renews annually; deletion swaps or influencer replacements require a one-off payment of $2,000 per influencer.",
                ],
                [
                  `${agencyBillingPlan.parallelGenerationsPerUser}`,
                  "Parallel generations",
                  "Per employee generation lanes. Image requests can include up to 4 outputs per generation, with higher quantities available for specific models.",
                ],
                [`${agencyBillingPlan.employeeAllowance}`, "Employee allowance", "Included seats for your agency team."],
                ["3", "Tab allowance", "Per employee access across image, video, and voice generation."],
                [`${agencyBillingPlan.dedicatedGpusPerEmployee}`, "Dedicated GPU", "Reserved GPU capacity per employee."],
                ["Included", "Auto Plug In", "Included with the Starter plan."],
                ["Included", "Auto Features", "Automation features are included with your plan."],
              ].map(([value, label, detail]) => {
                const valueIsNumber = /^\d+$/.test(value);
                return (
                  <div key={label} className="group grid grid-cols-[4.75rem_minmax(0,1fr)] gap-3 rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-3 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-soft-hover)]">
                    <div
                      className={cx(
                        "flex h-12 items-center justify-center rounded-xl bg-[color:var(--accent-soft)] px-2 text-center font-bold text-[color:var(--accent-text)]",
                        valueIsNumber ? "text-2xl tracking-tight" : "text-[10px] uppercase tracking-[0.08em]",
                      )}
                    >
                      {value}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[color:var(--text-strong)]">{label}</p>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className={theme.cardStrong + " rounded-[28px] border border-[color:var(--surface-border)] p-5 sm:p-6"}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Buy Credits</p>
              <h2 className="font-display mt-2 text-2xl text-[color:var(--text-strong)]">Add agency credits</h2>
              <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">Local test processor only. No live charge is created.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[color:var(--border-strong)] bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-bold text-[color:var(--accent-text)]">
                $1 = 1 credit
              </span>
              <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--text-main)]">
                Test mode
              </span>
            </div>
          </div>

          <div className="mt-5 grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {creditPurchaseOptions.map((option) => {
              const selected = option.id === selectedCreditPurchaseId;
              return (
                <button
                  key={option.id}
                  className={cx(
                    "flex min-h-[124px] flex-col justify-between rounded-2xl border px-4 py-4 text-left transition",
                    selected
                      ? "border-[color:var(--border-strong)] bg-[color:var(--accent-soft)]"
                      : "border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] hover:bg-[color:var(--surface-soft-hover)]",
                  )}
                  onClick={() => {
                    setSelectedCreditPurchaseId(option.id);
                    setProcessorNotice(null);
                  }}
                  type="button"
                >
                  <span>
                    <span className="block text-sm font-semibold text-[color:var(--text-strong)]">{option.label}</span>
                    <span className="mt-2 block text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Credit package</span>
                  </span>
                  <span className="block text-xs font-semibold text-[color:var(--text-main)]">Balance to {(agencyBillingPlan.creditBalance + option.amount).toLocaleString()}</span>
                </button>
              );
            })}

            <button
              className={cx(
                "flex min-h-[124px] flex-col justify-between rounded-2xl border px-4 py-4 text-left transition",
                selectedCreditPurchaseId === "custom"
                  ? "border-[color:var(--border-strong)] bg-[color:var(--accent-soft)]"
                  : "border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] hover:bg-[color:var(--surface-soft-hover)]",
              )}
              onClick={() => {
                setSelectedCreditPurchaseId("custom");
                setProcessorNotice(null);
              }}
              type="button"
            >
              <span>
                <span className="block text-sm font-semibold text-[color:var(--text-strong)]">Custom credits</span>
                <span className="mt-2 block text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Choose amount</span>
              </span>
              <span className="block text-xs font-semibold text-[color:var(--text-main)]">Balance to {projectedCreditBalance.toLocaleString()}</span>
            </button>
          </div>

          <div className="mt-3 min-h-[116px] rounded-[24px] border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-4">
            {selectedCreditPurchaseId === "custom" ? (
              <label className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-end">
                <span>
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Custom amount</span>
                  <span className="mt-2 block text-sm leading-6 text-[color:var(--text-muted)]">Set a custom credit top-up in $100 increments.</span>
                </span>
                <span className="block space-y-2">
                  <input
                    className={theme.input}
                    min="100"
                    onChange={(event) => {
                      setCustomCreditAmount(event.target.value);
                      setProcessorNotice(null);
                    }}
                    step="100"
                    type="number"
                    value={customCreditAmount}
                  />
                  <span className="block text-xs text-[color:var(--text-muted)]">Projected balance {projectedCreditBalance.toLocaleString()}</span>
                </span>
              </label>
            ) : (
              <div className="flex h-full flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Selected package</p>
                  <p className="mt-2 text-lg font-semibold text-[color:var(--text-strong)]">{selectedCreditPurchase.label}</p>
                  <p className="mt-1 text-sm text-[color:var(--text-muted)]">Projected balance {projectedCreditBalance.toLocaleString()} credits.</p>
                </div>
                <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-2 text-sm font-bold text-[color:var(--text-strong)]">
                  ${selectedCreditAmount.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Pay with</p>
                  <p className="mt-1 text-sm text-[color:var(--text-muted)]">Select one method to reveal the matching local test details.</p>
                </div>
                <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--text-main)]">
                  Secure test checkout
                </span>
              </div>

              <div className="grid auto-rows-fr gap-3 lg:grid-cols-3">
                {paymentMethodOptions.map((option) => {
                  const selected = option.id === selectedPaymentMethod.id;
                  return (
                    <button
                      key={option.id}
                      className={cx(
                        "flex min-h-[236px] flex-col justify-between rounded-[24px] border p-4 text-left transition",
                        selected
                          ? "border-[color:var(--border-strong)] bg-[color:var(--accent-soft)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent-main)_24%,transparent)]"
                          : "border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] hover:bg-[color:var(--surface-soft-hover)]",
                      )}
                      onClick={() => {
                        setSelectedPaymentMethodId(option.id);
                        setProcessorNotice(null);
                      }}
                      type="button"
                    >
                      <div>
                        <div className="flex min-h-9 items-start justify-between gap-3">
                          <PaymentLogoStrip logos={option.logoBadges} compact />
                          <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--accent-text)]">
                            {option.discountLabel}
                          </span>
                        </div>
                        <p className="mt-4 text-base font-semibold text-[color:var(--text-strong)]">{option.label}</p>
                        <p className="mt-2 min-h-10 text-sm leading-5 text-[color:var(--text-muted)]">{option.description}</p>
                      </div>
                      <div className="mt-4 grid gap-2 text-xs text-[color:var(--text-muted)]">
                        <div className="flex items-center justify-between gap-3">
                          <span>Settlement</span>
                          <span className="font-semibold text-[color:var(--text-strong)]">{option.settlementLabel}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>{option.detailLabel}</span>
                          <span className="font-semibold text-[color:var(--text-strong)]">{option.detailValue}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[24px] border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-4 text-sm text-[color:var(--text-muted)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Order summary</p>
                  <p className="mt-1 text-base font-semibold text-[color:var(--text-strong)]">{selectedPaymentMethod.label}</p>
                </div>
                <PaymentLogoStrip logos={selectedPaymentMethod.logoBadges.slice(0, 2)} compact />
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between gap-3">
                  <span>Credits selected</span>
                  <span className="font-semibold text-[color:var(--text-strong)]">${selectedCreditAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>{selectedPaymentMethod.discountLabel}</span>
                  <span className="font-semibold text-[color:var(--accent-text)]">-${paymentDiscount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Projected balance</span>
                  <span className="font-semibold text-[color:var(--text-strong)]">{projectedCreditBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between gap-3 border-t border-[color:var(--surface-border)] pt-3 text-[color:var(--text-strong)]">
                  <span className="font-semibold">Local test total</span>
                  <span className="font-bold">${paymentTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 min-h-[360px] rounded-[24px] border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Payment details</p>
                <h3 className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{selectedPaymentMethod.label}</h3>
              </div>
              <PaymentLogoStrip logos={selectedPaymentMethod.logoBadges} compact />
            </div>

            {selectedPaymentMethod.id === "card" ? (
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_120px_100px]">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Test card</span>
                  <input className={theme.input} readOnly value="4242 4242 4242 4242" />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Expiry</span>
                  <input className={theme.input} readOnly value="12/30" />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">CVC</span>
                  <input className={theme.input} readOnly value="123" />
                </label>
                <div className="grid gap-3 rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] p-4 md:col-span-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Billing address</p>
                    <p className="mt-1 text-sm text-[color:var(--text-muted)]">Use the cardholder billing details for local test checkout.</p>
                  </div>
                  <label className="block space-y-2 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Address line 1</span>
                    <input className={theme.input} defaultValue="123 Market Street" />
                  </label>
                  <label className="block space-y-2 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Address line 2</span>
                    <input className={theme.input} placeholder="Apartment, suite, unit, or floor" />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">City</span>
                    <input className={theme.input} defaultValue="San Francisco" />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">State / region</span>
                    <input className={theme.input} defaultValue="CA" />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Post code</span>
                    <input className={theme.input} defaultValue="94103" />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Country</span>
                    <select className={theme.input} defaultValue="United States">
                      {billingCountryOptions.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : null}

            {selectedPaymentMethod.id === "bank" ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Beneficiary</p>
                  <p className="mt-1 font-semibold text-[color:var(--text-strong)]">AutoScale Agency Credits</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Reference</p>
                  <p className="mt-1 font-semibold text-[color:var(--text-strong)]">AS-LATTICE-{selectedCreditAmount.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Routing</p>
                  <p className="mt-1 font-semibold text-[color:var(--text-strong)]">ACH 021000021</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Discount</p>
                  <p className="mt-1 font-semibold text-[color:var(--accent-text)]">2% bank transfer savings</p>
                </div>
              </div>
            ) : null}

            {selectedPaymentMethod.id === "crypto" ? (
              <div className="mt-4 grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                <div className="flex aspect-square items-center justify-center rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] p-4">
                  <div className="grid h-full w-full grid-cols-4 gap-1">
                    {Array.from({ length: 16 }).map((_, index) => (
                      <span key={index} className={cx("rounded-sm", index % 3 === 0 ? "bg-[color:var(--accent-main)]" : "bg-[color:var(--surface-soft-hover)]")} />
                    ))}
                  </div>
                </div>
                <div className="grid gap-3">
                  <label className="block space-y-2 rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Pay with crypto</span>
                    <select
                      className={theme.input}
                      onChange={(event) => {
                        setSelectedCryptoPaymentId(event.target.value);
                        setProcessorNotice(null);
                      }}
                      value={selectedCryptoPaymentId}
                    >
                      {cryptoPaymentOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label} ({option.symbol})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Selected asset</p>
                    <p className="mt-1 font-semibold text-[color:var(--text-strong)]">
                      {selectedCryptoPayment.symbol} on {selectedCryptoPayment.network}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Wallet</p>
                    <p className="mt-1 break-all font-semibold text-[color:var(--text-strong)]">
                      autoscale-{selectedCryptoPayment.symbol.toLowerCase()}-test-wallet-7f42...91c8
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Discount</p>
                    <p className="mt-1 font-semibold text-[color:var(--accent-text)]">5% crypto settlement savings</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <button
            className={theme.buttonPrimary + " mt-5 w-full sm:w-auto"}
            onClick={() =>
              setProcessorNotice(
                `Local test approved for ${selectedCreditLabel} by ${selectedPaymentMethod.label}. Total after discount: $${paymentTotal.toLocaleString()}. Projected balance: ${projectedCreditBalance.toLocaleString()} credits.`,
              )
            }
            type="button"
          >
            {paymentActionLabel}
          </button>

          {processorNotice ? (
            <div className="mt-4 rounded-2xl border border-lime-300/25 bg-lime-300/10 px-4 py-3 text-sm font-semibold text-lime-100">
              {processorNotice}
            </div>
          ) : null}
        </section>
      </div>

      <section className="overflow-hidden rounded-[32px] border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)]">
        <div className="flex flex-col xl:flex-row">
          <div className="relative flex flex-col justify-between gap-8 overflow-hidden border-b border-[color:var(--surface-border)] bg-[color:var(--surface-card)] p-6 sm:p-8 xl:flex-[2_1_0%] xl:border-b-0 xl:border-r">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-70" style={planGlowStyle} />
            <div className="relative z-10 max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Upgrade Options</p>
              <h2 className="font-display mt-3 max-w-2xl text-3xl text-[color:var(--text-strong)] sm:text-4xl">
                Enterprise AI generation infrastructure for agencies producing at scale
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)] sm:text-base">
                Tailored workflows, dedicated support, flexible capacity, advanced controls, and no training on your private agency data.
              </p>
            </div>

            <div className="relative z-10 grid gap-3 md:grid-cols-3">
              {[
                ["Security and compliance", "Private production environments, role-based access, and no model training on your data."],
                ["Data and usage rights", "Your agency retains rights to generated outputs for publishing, editing, and commercial reuse."],
                ["Admin control", "Centralized permissions, team governance, credit controls, and scalable workspace management."],
              ].map(([title, description]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-[color:var(--surface-border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--text-strong)_3%,transparent),color-mix(in_srgb,var(--text-strong)_5%,transparent))] p-4"
                >
                  <div className="flex size-9 items-center justify-center rounded-xl bg-[color:var(--accent-soft)] text-[color:var(--accent-text)]">
                    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 3.25 19 6v5.35c0 4.45-2.85 7.58-7 9.4-4.15-1.82-7-4.95-7-9.4V6l7-2.75Z"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    </svg>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-[color:var(--text-strong)]">{title}</p>
                  <p className="mt-2 text-xs leading-5 text-[color:var(--text-muted)]">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-6 bg-[color:var(--surface-card-strong)] p-6 sm:p-8 xl:flex-[1_1_0%] xl:min-w-[320px]">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text-muted)]">Everything in {agencyBillingPlan.currentPlan}, plus:</p>
              <div className="mt-4 grid gap-2">
                {[
                  "Unlimited team members",
                  "Custom credit packages",
                  "Dedicated model capacity",
                  "Access to all available generation models",
                  "Volume-based discounts",
                  "Priority processing queue",
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-strong)]">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[color:var(--accent-text)]">
                      <svg aria-hidden="true" className="size-3.5" viewBox="0 0 24 24" fill="none">
                        <path d="m6 12 4 4 8-8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
                      </svg>
                    </span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <button className={theme.buttonPrimary + " h-13 w-full rounded-xl text-sm"} type="button">
                Contact sales
              </button>
              <button className={theme.buttonSecondary + " h-13 w-full rounded-xl text-sm"} type="button">
                Learn more
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
