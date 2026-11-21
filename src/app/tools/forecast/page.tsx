"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CreditCard, Gauge, Hourglass, Receipt, TrendingDown } from "lucide-react";
import { ForecastChart, daysLabel } from "@/components/tools-ui";
import { BigMoney, Card, cx, EmptyState, Loading, Money, PageHeader, SectionTitle, Segmented } from "@/components/ui";
import { daysBetween, formatDay, fromISO, toISO, todayISO } from "@/lib/dates";
import { useLedger } from "@/lib/hooks";
import { useMoney } from "@/lib/privacy";
import { forecast, MIN_FORECAST_HISTORY, payCycle, type ForecastEvent } from "@/lib/tools";
import { usePaydays } from "@/lib/tools-hooks";

type Horizon = "payday" | "month";

const EVENT_ICON: Record<ForecastEvent["kind"], typeof Receipt> = { income: ArrowUpRight, bill: Receipt, card: CreditCard };

/** End of this month, or of next month when this one ends today or on payday (the two tabs would match). */
function monthEnd(today: string, payday: string) {
  const d = fromISO(today);
  const end = toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  return end === today || end === payday ? toISO(new Date(d.getFullYear(), d.getMonth() + 2, 0)) : end;
}

export default function ForecastPage() {
  const ledger = useLedger();
  const { paydays, moveEarlier, loading } = usePaydays();
  const { hidden } = useMoney();
  const today = todayISO();
  const [horizon, setHorizon] = useState<Horizon>("payday");
  const payday = payCycle(today, paydays, moveEarlier).nextPayday;
  const end = monthEnd(today, payday);
  const until = horizon === "payday" ? payday : end;
  const f = useMemo(() => forecast(ledger, today, until, paydays, moveEarlier), [ledger, today, until, paydays, moveEarlier]);
  const days = daysBetween(today, until);
  const hasCash = ledger.activeAccounts.some((a) => a.type !== "credit");
  const dips = f.lowest && f.lowest.balance < f.start;

  return (
    <>
      <PageHeader title="Forecast" back="/tools" />
      {!ledger.ready || loading ? <Loading /> : !hasCash ? (
        <Card className="mx-4"><EmptyState title="No cash accounts" body="Add a cash or bank account to forecast your balance." /></Card>
      ) : (
        <div className="space-y-4 px-4 pb-4">
          <Segmented
            value={horizon}
            onChange={setHorizon}
            options={[{ value: "payday", label: `To payday · ${formatDay(payday)}` }, { value: "month", label: `Month end · ${formatDay(end)}` }]}
          />

          {!f.enoughHistory ? (
            <Card className="space-y-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-ink-2"><Gauge className="size-4 text-brand" aria-hidden="true" /> At this pace</p>
              <BigMoney minor={f.start - f.pace * days} className={cx("block text-[2rem] leading-tight", f.start - f.pace * days < 0 && "text-expense")} />
              <p className="text-sm text-ink-2">
                You&apos;ve spent about <Money minor={f.pace} className="font-semibold" /> a day so far. Keep that up and you&apos;d have this much left by {formatDay(until)}, before any income.
              </p>
              <p className="flex items-start gap-2 rounded-2xl bg-pale px-3 py-2.5 text-xs text-ink-2">
                <Hourglass className="mt-px size-3.5 shrink-0 text-brand" aria-hidden="true" />
                A full forecast with bills and paydays needs about {MIN_FORECAST_HISTORY} days of history. You have {daysLabel(f.historyDays)} so far.
              </p>
            </Card>
          ) : (
            <>
              <Card className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-3">Projected on {formatDay(until)}</p>
                    <BigMoney minor={f.end?.balance ?? f.start} className={cx("block text-[2rem] leading-tight", (f.end?.balance ?? 0) < 0 && "text-expense")} />
                  </div>
                  <div className="shrink-0 pt-1 text-right text-xs text-ink-3">
                    <p>Today</p>
                    <Money minor={f.start} className="text-sm font-semibold text-ink-2" />
                  </div>
                </div>
                {dips && f.lowest && (
                  <p className={cx("flex items-start gap-2 rounded-2xl px-3 py-2.5 text-sm", f.lowest.balance < 0 ? "bg-expense/10 text-expense" : "bg-pale text-ink-2")}>
                    <TrendingDown className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                      May dip to <Money minor={f.lowest.balance} className="font-semibold" /> around {formatDay(f.lowest.date)}
                      {f.lowestCause ? `, when ${f.lowestCause.label.replace(/ due$/, "")} is due` : ""}.
                      {f.lowest.balance < 0 && " That's below zero."}
                    </span>
                  </p>
                )}
                {!hidden && f.points.length > 1 && <ForecastChart points={f.points} lowest={dips ? f.lowest : null} />}
                <p className="text-xs text-ink-3">
                  Assumes about <Money minor={f.daily.typical} /> a day of everyday cash spending (your median week), with <Money minor={f.daily.low} /> to <Money minor={f.daily.high} /> and your lowest and highest bills making up the range.
                </p>
              </Card>

              <Card className="p-2">
                <div className="px-2 pt-2"><SectionTitle>Coming up</SectionTitle></div>
                {f.events.length ? (
                  <ul>
                    {f.events.map((e, i) => {
                      const Icon = EVENT_ICON[e.kind];
                      return (
                        <li key={`${e.date}-${e.label}-${i}`} className="flex items-center gap-3 px-2 py-2.5">
                          <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl bg-pale", e.amount > 0 ? "text-income" : "text-brand")} aria-hidden="true">
                            <Icon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{e.label}</span>
                            <span className="block text-xs text-ink-3">{formatDay(e.date)} · {e.kind === "income" ? "Expected income" : e.kind === "card" ? "Card payment" : "Bill"}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold">
                            {e.amount < 0 ? <ArrowDownRight className="size-3.5 text-expense" aria-hidden="true" /> : <ArrowUpRight className="size-3.5 text-income" aria-hidden="true" />}
                            <Money minor={Math.abs(e.amount)} />
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="px-2 pb-3 text-sm text-ink-3">No income, bills or card dues expected before {formatDay(until)}.</p>
                )}
              </Card>
              <p className="px-1 text-xs text-ink-3">Cash and bank accounts only. Card purchases leave your cash on the card&apos;s due date. Income and bills are the recurring ones found in your history.</p>
            </>
          )}
        </div>
      )}
    </>
  );
}
