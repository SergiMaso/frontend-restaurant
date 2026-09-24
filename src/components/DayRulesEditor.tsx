import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, RotateCcw, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { SlotConfig, PaymentConfig, ServicePaymentConfig } from "@/services/api";

type Service = "lunch" | "dinner";

export interface DayRulesValue {
  slot_config?: SlotConfig | null;
  payment_config?: PaymentConfig | null;
}

export interface InheritedPayment {
  amount?: number;
  minPeople?: number;
  currency?: string;
  /**
   * Whether the level above asks for a deposit at all. Without it the checkbox showed
   * "required" for a weekday that had turned deposits off, and typing an amount wrote
   * an override that still inherited required=false — a deposit shown, never charged.
   */
  required?: boolean;
}

interface DayRulesEditorProps {
  value: DayRulesValue;
  onChange: (next: DayRulesValue) => void;
  /** Only 'fixed' has per-slot caps; in interval mode the slot sections are hidden. */
  timeSlotsMode: string;
  /** Slots inherited from the level above, shown as placeholders. */
  inheritedSlots: Record<Service, string[]>;
  /**
   * The caps those inherited slots carry. A customised service owns its WHOLE slot
   * list, so seeding every inherited time with null ("no limit") silently removed the
   * caps on every sitting except the one being changed — and allowed overbooking.
   */
  inheritedSlotCaps?: Partial<Record<Service, Record<string, number | null>>>;
  /**
   * Deposit inherited from the level above, PER SERVICE. A weekday can override lunch
   * and dinner differently, so one figure for both would suggest the wrong price for
   * whichever service it did not come from.
   */
  inheritedPayment?: Partial<Record<Service, InheritedPayment>>;
  /** False when the restaurant cannot take deposits — the payment sections disappear. */
  paymentsAvailable: boolean;
  /**
   * Only owners (and superadmins) change deposit rules; the API refuses anyone else.
   * The section stays visible, read-only, so an admin can see what applies.
   */
  canEditDeposits?: boolean;
  /** Which services are open; a closed one has nothing to configure. */
  openServices: Service[];
}

/**
 * One collapsible block. Defined at module level on purpose: declared inside the
 * editor, it was a new component type on every render, so React unmounted and
 * remounted it — and the input being typed into — on every keystroke. Focus was lost
 * after each digit of a cap or an amount.
 */
const Section = ({ title, summary, overridden, expanded, onToggle, onReset, resetTitle,
                   children }: {
  title: string; summary: string; overridden: boolean; expanded: boolean;
  onToggle: () => void; onReset?: () => void; resetTitle: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-md border border-border/40">
    <div className="flex items-center gap-2 px-2 py-1.5">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-sm hover:underline"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {title}
      </button>
      <span className="text-xs text-muted-foreground ml-auto">{summary}</span>
      {/* Only offered once something IS overridden — the one way back to inheriting. */}
      {overridden && onReset && (
        <Button type="button" variant="ghost" size="sm" onClick={onReset} title={resetTitle}>
          <RotateCcw className="h-3 w-3" />
        </Button>
      )}
    </div>
    {expanded && <div className="px-3 pb-3 pt-1 space-y-2">{children}</div>}
  </div>
);

/**
 * Slots and deposits for one day, shared by the weekday template and the single-date
 * dialog. The only difference between them is what "inherit" points at, which is why
 * this takes the inherited values rather than fetching anything.
 *
 * Everything is collapsed by default and every section shows its state in one line, so
 * someone who only came to change the opening hours never has to look at any of it.
 * That is the whole design constraint: these dialogs already exist and are already the
 * place staff go for hours.
 */
const DayRulesEditor = ({
  value, onChange, timeSlotsMode, inheritedSlots, inheritedSlotCaps, inheritedPayment,
  paymentsAvailable, canEditDeposits = true, openServices,
}: DayRulesEditorProps) => {
  const { t } = useTranslation("dashboard");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const showSlots = timeSlotsMode === "fixed";
  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── slots ────────────────────────────────────────────────────────────────
  const slotsFor = (service: Service): Record<string, number | null> | null =>
    value.slot_config?.[service] ?? null;

  const setSlots = (service: Service, slots: Record<string, number | null> | null) => {
    const next = { ...(value.slot_config || {}) };
    if (slots === null) {
      delete next[service];
    } else {
      next[service] = slots;
    }
    // No services left means nothing is overridden — send null, not {}, or the backend
    // records this level as the origin of values it never supplied.
    onChange({ ...value, slot_config: Object.keys(next).length ? next : null });
  };

  const startOverridingSlots = (service: Service) => {
    // Seed from what is inherited — times AND caps — so the first edit is a change to
    // one sitting, not the removal of every other sitting's limit.
    const caps = inheritedSlotCaps?.[service] || {};
    const seeded: Record<string, number | null> = {};
    (inheritedSlots[service] || []).forEach((time) => { seeded[time] = caps[time] ?? null; });
    setSlots(service, seeded);
  };

  // ── payment ──────────────────────────────────────────────────────────────
  const paymentFor = (service: Service): ServicePaymentConfig | null =>
    value.payment_config?.[service] ?? null;

  const setPayment = (service: Service, block: ServicePaymentConfig | null) => {
    const next = { ...(value.payment_config || {}) };
    if (block === null) {
      delete next[service];
    } else {
      next[service] = block;
    }
    onChange({ ...value, payment_config: Object.keys(next).length ? next : null });
  };

  // ── summaries ────────────────────────────────────────────────────────────
  const slotSummary = (service: Service) => {
    const own = slotsFor(service);
    if (!own) {
      const count = (inheritedSlots[service] || []).length;
      return t("dayRules.inheritedSlots", { count });
    }
    const times = Object.keys(own).sort();
    const caps = times.map((tm) => (own[tm] == null ? "–" : String(own[tm])));
    return t("dayRules.ownSlots", { count: times.length, caps: caps.join("/") });
  };

  const paymentSummary = (service: Service) => {
    const own = paymentFor(service);
    const inherited = inheritedPayment?.[service];
    const required = own?.required ?? inherited?.required ?? true;
    if (!own) {
      if (!required || !inherited?.amount) return t("dayRules.inheritedNoDeposit");
      return t("dayRules.inheritedDeposit", {
        amount: inherited.amount,
        currency: inherited.currency || "EUR",
        people: inherited.minPeople ?? 1,
      });
    }
    if (!required) return t("dayRules.noDepositHere");
    return t("dayRules.ownDeposit", {
      amount: own.amount ?? inherited?.amount ?? "–",
      currency: inherited?.currency || "EUR",
      people: own.min_people ?? inherited?.minPeople ?? 1,
    });
  };

  return (
    <div className="space-y-3">
      {openServices.map((service) => (
        <div key={service} className="space-y-1.5">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {t(`dayRules.${service}`)}
          </p>

          {showSlots && (
            <Section
              title={t("dayRules.slots")}
              summary={slotSummary(service)}
              overridden={!!slotsFor(service)}
              expanded={!!expanded[`slots-${service}`]}
              onToggle={() => toggle(`slots-${service}`)}
              onReset={() => setSlots(service, null)}
              resetTitle={t("dayRules.reset")}
            >
              {!slotsFor(service) ? (
                <Button type="button" variant="outline" size="sm"
                        onClick={() => startOverridingSlots(service)}>
                  {t("dayRules.customiseSlots")}
                </Button>
              ) : (
                <SlotRows
                  slots={slotsFor(service)!}
                  onChange={(next) => setSlots(service, next)}
                />
              )}
            </Section>
          )}

          {paymentsAvailable && (
            <Section
              title={t("dayRules.payment")}
              summary={paymentSummary(service)}
              overridden={!!paymentFor(service)}
              expanded={!!expanded[`pay-${service}`]}
              onToggle={() => toggle(`pay-${service}`)}
              onReset={canEditDeposits ? () => setPayment(service, null) : undefined}
              resetTitle={t("dayRules.reset")}
            >
              <PaymentRows
                block={paymentFor(service)}
                inherited={inheritedPayment?.[service]}
                readOnly={!canEditDeposits}
                onChange={(next) => setPayment(service, next)}
              />
            </Section>
          )}
        </div>
      ))}
    </div>
  );
};

/** Per-slot caps. An empty box means "no limit", never zero. */
const SlotRows = ({ slots, onChange }: {
  slots: Record<string, number | null>;
  onChange: (next: Record<string, number | null>) => void;
}) => {
  const { t } = useTranslation("dashboard");
  const [newTime, setNewTime] = useState("");
  const times = Object.keys(slots).sort();
  // The backend refuses a customised service with no sittings, so removing the last
  // one only produced a save that failed. Closing a service is done with its hours.
  const lastOne = times.length <= 1;

  const setCap = (time: string, raw: string) => {
    const next = { ...slots };
    // Blank is "no cap", which is NOT the same as 0 — 0 would close the slot. The
    // placeholder says so, because an empty box and a zeroed one look alike otherwise.
    next[time] = raw.trim() === "" ? null : Number.parseInt(raw, 10);
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      {times.map((time) => (
        <div key={time} className="flex items-center gap-2">
          <span className="text-sm w-14 tabular-nums">{time}</span>
          <Input
            type="number" min="0" step="1"
            value={slots[time] == null ? "" : String(slots[time])}
            placeholder={t("dayRules.noLimit")}
            onChange={(e) => setCap(time, e.target.value)}
            className="max-w-[110px] h-8"
          />
          <span className="text-xs text-muted-foreground">{t("dayRules.people")}</span>
          <Button
            type="button" variant="ghost" size="sm" className="ml-auto"
            disabled={lastOne}
            title={lastOne ? t("dayRules.lastSlot") : undefined}
            onClick={() => {
              const next = { ...slots };
              delete next[time];
              onChange(next);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <Input
          type="time" value={newTime}
          onChange={(e) => setNewTime(e.target.value)}
          className="max-w-[120px] h-8"
        />
        <Button
          type="button" variant="outline" size="sm"
          disabled={!newTime || newTime in slots}
          onClick={() => { onChange({ ...slots, [newTime]: null }); setNewTime(""); }}
        >
          <Plus className="h-3 w-3 mr-1" />
          {t("dayRules.addSlot")}
        </Button>
      </div>
    </div>
  );
};

/** Deposit for one service. Each field is separately inheritable. */
const PaymentRows = ({ block, inherited, readOnly = false, onChange }: {
  block: ServicePaymentConfig | null;
  inherited?: InheritedPayment | null;
  readOnly?: boolean;
  onChange: (next: ServicePaymentConfig | null) => void;
}) => {
  const { t } = useTranslation("dashboard");
  // What actually applies: this level's choice, else the level above's, else yes.
  const required = block?.required ?? inherited?.required ?? true;

  const patch = (fields: Partial<ServicePaymentConfig>) =>
    onChange({ ...(block || {}), ...fields });

  return (
    <div className="space-y-2">
      {readOnly && (
        <p className="text-xs text-muted-foreground">{t("dayRules.ownerOnlyDeposits")}</p>
      )}
      <div className="flex items-center gap-2">
        <Checkbox
          id={`req-${JSON.stringify(block)}`}
          checked={required}
          disabled={readOnly}
          onCheckedChange={(checked) => patch({ required: checked === true })}
        />
        <Label className="cursor-pointer text-sm">{t("dayRules.depositRequired")}</Label>
      </div>

      {required && (
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs">{t("dayRules.amountPerPerson")}</Label>
          <Input
            type="number" min="0" step="0.01"
            disabled={readOnly}
            value={block?.amount == null ? "" : String(block.amount)}
            /* Empty shows the inherited figure as a placeholder, so "not set here"
               never looks like "set to nothing". */
            placeholder={inherited?.amount != null ? String(inherited.amount) : "–"}
            onChange={(e) => patch({
              amount: e.target.value.trim() === "" ? undefined : Number.parseFloat(e.target.value),
            })}
            className="max-w-[110px] h-8"
          />
          <span className="text-xs text-muted-foreground">{inherited?.currency || "EUR"}</span>

          <Label className="text-xs ml-2">{t("dayRules.fromPeople")}</Label>
          <Input
            type="number" min="1" step="1"
            disabled={readOnly}
            value={block?.min_people == null ? "" : String(block.min_people)}
            placeholder={inherited?.minPeople != null ? String(inherited.minPeople) : "1"}
            onChange={(e) => patch({
              min_people: e.target.value.trim() === "" ? undefined : Number.parseInt(e.target.value, 10),
            })}
            className="max-w-[90px] h-8"
          />
        </div>
      )}
    </div>
  );
};

export default DayRulesEditor;
