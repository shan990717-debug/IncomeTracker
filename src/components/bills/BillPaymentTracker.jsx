import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths } from 'date-fns';
import { monthStr } from '@/lib/finance';
import { Check, X } from 'lucide-react';

function getLastNMonths(currentMonth, n) {
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = subMonths(currentMonth, i);
    months.push({ date: d, mStr: monthStr(d), label: format(d, 'MMM yy') });
  }
  return months;
}

export default function BillPaymentTracker({ lang, bills, currentMonth }) {
  const months = getLastNMonths(currentMonth, 5);

  const { data: allPayments = [] } = useQuery({
    queryKey: ['billPaymentsTracker', months.map(m => m.mStr).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        months.map(m => base44.entities.BillPayment.filter({ month: m.mStr }))
      );
      return results.flat();
    },
  });

  const getPayment = (billId, mStr) =>
    allPayments.find(p => p.bill_id === billId && p.month === mStr);

  const activeBills = bills.filter(b => b.is_active && !b.is_shared_family)
    .sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));

  if (activeBills.length === 0) {
    return (
      <p className="text-center text-muted-foreground text-sm py-8">
        {lang === 'zh' ? '暂无账单模板' : 'No bill templates found'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {lang === 'zh' ? '过去 5 个月付款状态' : 'Payment status over last 5 months'}
      </p>

      {/* Header row */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left font-semibold text-muted-foreground pb-2 pr-3 min-w-[120px]">
                {lang === 'zh' ? '账单' : 'Bill'}
              </th>
              {months.map(m => (
                <th key={m.mStr} className={`text-center font-semibold pb-2 px-1 min-w-[52px] ${m.mStr === monthStr(currentMonth) ? 'text-primary' : 'text-muted-foreground'}`}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {activeBills.map(bill => (
              <tr key={bill.id}>
                <td className="py-2 pr-3">
                  <p className="font-semibold text-foreground truncate max-w-[120px]">{bill.name}</p>
                  {bill.default_amount > 0 && (
                    <p className="text-[10px] text-muted-foreground">RM {bill.default_amount.toFixed(0)}</p>
                  )}
                </td>
                {months.map(m => {
                  const payment = getPayment(bill.id, m.mStr);
                  const isCurrentMonth = m.mStr === monthStr(currentMonth);
                  return (
                    <td key={m.mStr} className="py-2 px-1 text-center">
                      {payment ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <StatusDot status={payment.status} isSettled={payment.is_settled} />
                          {payment.amount > 0 && (
                            <span className="text-[9px] text-muted-foreground">
                              {payment.amount.toFixed(0)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-block w-5 h-5 rounded-full bg-secondary border border-border" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-1 text-[10px] text-muted-foreground">
        {[
          { color: 'bg-emerald-500', label: lang === 'zh' ? '已结清' : 'Settled' },
          { color: 'bg-blue-500', label: lang === 'zh' ? '已付' : 'Paid' },
          { color: 'bg-amber-400', label: lang === 'zh' ? '待付' : 'Pending' },
          { color: 'bg-destructive', label: lang === 'zh' ? '逾期' : 'Overdue' },
          { color: 'bg-secondary border border-border', label: lang === 'zh' ? '未生成' : 'Not generated' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded-full inline-block ${l.color}`} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusDot({ status, isSettled }) {
  if (isSettled) return <span className="inline-block w-5 h-5 rounded-full bg-emerald-500" title="Settled" />;
  if (status === 'paid') return <span className="inline-block w-5 h-5 rounded-full bg-blue-500" title="Paid" />;
  if (status === 'overdue') return <span className="inline-block w-5 h-5 rounded-full bg-destructive" title="Overdue" />;
  return <span className="inline-block w-5 h-5 rounded-full bg-amber-400" title="Pending" />;
}