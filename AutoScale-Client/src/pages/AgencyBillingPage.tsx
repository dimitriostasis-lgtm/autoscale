import { useState } from "react";

import { agencyBillingPlan, creditPurchaseOptions, paymentMethodOptions, planGlowStyle, upgradeOptions } from "../lib/billing";
import { cx } from "../lib/cx";
import { theme } from "../styles/theme";
import type { UserRecord } from "../types";

interface AgencyBillingPageProps {
  currentUser: UserRecord;
}

type PaymentLogoBadge = (typeof paymentMethodOptions)[number]["logoBadges"][number];

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
  const [processorNotice, setProcessorNotice] = useState<string | null>(null);
  const selectedCreditPurchase = creditPurchaseOptions.find((option) => option.id === selectedCreditPurchaseId) || creditPurchaseOptions[0];
  const customCreditAmountValue = Math.max(0, Number(customCreditAmount) || 0);
  const selectedCreditAmount = selectedCreditPurchaseId === "custom" ? customCreditAmountValue : selectedCreditPurchase.amount;
  const selectedCreditLabel = selectedCreditPurchaseId === "custom" ? `$${selectedCreditAmount.toLocaleString()} custom credits` : selectedCreditPurchase.label;
  const selectedPaymentMethod = paymentMethodOptions.find((option) => option.id === selectedPaymentMethodId) || paymentMethodOptions[0];
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
          className="billing-current-plan-card relative overflow-hidden rounded-[26px] border bg-[color:var(--surface-soft)] p-5 shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent-main)_42%,transparent),0_22px_70px_color-mix(in_srgb,var(--accent-main)_12%,transparent)]"
          style={{ borderColor: "color-mix(in srgb, var(--accent-main) 72%, transparent)" }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-80" style={planGlowStyle} />
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Current Plan</p>
            <p className="mt-4 text-4xl font-semibold tracking-tight text-[color:var(--text-strong)]">{agencyBillingPlan.currentPlan}</p>
            <p className="mt-3 text-lg font-semibold text-[color:var(--accent-text)]">{agencyBillingPlan.currentPrice}</p>
            <p className="mt-2 text-sm font-semibold text-[color:var(--text-muted)]">{agencyBillingPlan.includedCredit}</p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--text-muted)]">
              {agencyBillingPlan.parallelGenerationsPerUser} parallel generations per user
            </p>
          </div>

          <div className="relative z-10 mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Credit balance</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--text-strong)]">{agencyBillingPlan.creditBalance.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Renews</p>
              <p className="mt-2 text-sm font-semibold text-[color:var(--text-strong)]">{agencyBillingPlan.renewalDate}</p>
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
            <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--text-main)]">
              Test mode
            </span>
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
                  <span className="mt-2 block text-sm leading-6 text-[color:var(--text-muted)]">Set a custom credit top-up while keeping the package selector stable.</span>
                </span>
                <span className="block space-y-2">
                  <input
                    className={theme.input}
                    min="100"
                    onChange={(event) => {
                      setCustomCreditAmount(event.target.value);
                      setProcessorNotice(null);
                    }}
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
                  <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Network</p>
                    <p className="mt-1 font-semibold text-[color:var(--text-strong)]">USDC on Base / BTC / ETH</p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-card)] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Wallet</p>
                    <p className="mt-1 break-all font-semibold text-[color:var(--text-strong)]">autoscale-test-wallet-7f42...91c8</p>
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

      <section className="space-y-4 rounded-[32px] border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Upgrade Options</p>
            <h2 className="font-display mt-2 text-3xl text-[color:var(--text-strong)]">Increase agency capacity</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">
              Move to a higher tier for more AI influencers, more flexible generation throughput, better scalability, priority support, and access to advanced production capabilities.
            </p>
          </div>
          <span className="rounded-full border border-[color:var(--border-strong)] bg-[color:var(--accent-soft)] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--accent-text)]">
            From {agencyBillingPlan.currentPlan}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {upgradeOptions.map((option) => {
            const hasPlanCapacity = "parallelGenerationsPerUser" in option;
            const highlighted = "featured" in option && option.featured;

            return (
              <article
                key={option.id}
                className={cx(
                  "billing-plan-option group relative flex min-h-[520px] flex-col overflow-hidden rounded-[28px] border bg-[color:var(--surface-card)] p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:border-[color:var(--border-strong)]",
                  highlighted ? "border-[color:var(--border-strong)]" : "border-[color:var(--surface-border)]",
                )}
              >
                <div aria-hidden="true" className={cx("pointer-events-none absolute inset-0 transition duration-300", highlighted ? "opacity-70" : "opacity-0 group-hover:opacity-100")} style={planGlowStyle} />

                <div className="relative z-10 flex flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--text-main)]">
                      {option.badge}
                    </span>
                    {highlighted ? (
                      <span className="rounded-full bg-[color:var(--accent-main)] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[color:var(--accent-foreground)]">
                        Recommended
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-5">
                    <h3 className="font-display text-3xl text-[color:var(--text-strong)]">{option.label}</h3>
                    <p className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--text-strong)]">{option.price}</p>
                    {"includedCredit" in option ? <p className="mt-2 text-sm font-bold text-[color:var(--accent-text)]">{option.includedCredit}</p> : null}
                    <p className="mt-4 text-sm leading-6 text-[color:var(--text-muted)]">{option.note}</p>
                  </div>

                  <div className="mt-5 grid gap-2">
                    <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Influencers</p>
                      <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{hasPlanCapacity ? option.label : "Custom capacity"}</p>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Parallel gen</p>
                      <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">
                        {hasPlanCapacity ? `${option.parallelGenerationsPerUser} per user` : "Custom"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Support</p>
                      <p className="mt-1 text-lg font-semibold text-[color:var(--text-strong)]">{option.supportLabel}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex-1 space-y-2">
                    {option.featureHighlights.map((highlight) => (
                      <div key={highlight} className="flex items-start gap-2 rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-soft)] px-3 py-2">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[color:var(--accent-main)]" />
                        <span className="text-sm font-semibold leading-5 text-[color:var(--text-main)]">{highlight}</span>
                      </div>
                    ))}
                  </div>

                  <button className={cx(highlighted ? theme.buttonPrimary : theme.buttonSecondary, "mt-5 w-full justify-center")} type="button">
                    {option.ctaLabel}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}