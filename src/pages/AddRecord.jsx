import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import IncomeStep from '@/components/record/IncomeStep';
import ExpenseStep from '@/components/record/ExpenseStep';
import StorageStep from '@/components/record/StorageStep';
import SummaryStep from '@/components/record/SummaryStep';
import { motion } from 'framer-motion';

const incomeKeys = ['income_grab', 'income_bolt', 'income_indrive', 'income_cash', 'income_tips', 'income_incentive', 'income_others'];
const expenseKeys = ['expense_petrol', 'expense_toll', 'expense_parking', 'expense_food', 'expense_car_maintenance', 'expense_others'];

const defaultData = {
  income_grab: '', income_bolt: '', income_indrive: '', income_cash: '', income_tips: '', income_incentive: '', income_others: '',
  expense_petrol: '', expense_toll: '', expense_parking: '', expense_food: '', expense_car_maintenance: '', expense_others: '',
  stored_bank: '', stored_cash: '',
};

export default function AddRecord() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [data, setData] = useState(defaultData);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const dateParam = urlParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  const editParam = urlParams.get('edit');

  useEffect(() => {
    if (editParam) {
      base44.entities.DailyRecord.list('-date', 100).then(records => {
        const rec = records.find(r => r.id === editParam);
        if (rec) {
          setEditId(rec.id);
          const loaded = {};
          Object.keys(defaultData).forEach(k => {
            loaded[k] = rec[k] ? rec[k].toString() : '';
          });
          setData(loaded);
        }
      });
    }
  }, [editParam]);

  const onChange = (key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  const totalIncome = incomeKeys.reduce((s, k) => s + (parseFloat(data[k]) || 0), 0);
  const totalExpense = expenseKeys.reduce((s, k) => s + (parseFloat(data[k]) || 0), 0);
  const actualIncome = totalIncome - totalExpense;

  const steps = [
    <IncomeStep key="income" data={data} onChange={onChange} />,
    <ExpenseStep key="expense" data={data} onChange={onChange} />,
    <StorageStep key="storage" data={data} onChange={onChange} actualIncome={actualIncome} />,
    <SummaryStep key="summary" data={data} totalIncome={totalIncome} totalExpense={totalExpense} actualIncome={actualIncome} />,
  ];

  const stepLabels = [t('incomeSource'), t('expenses'), t('storage'), t('summary')];

  const handleSave = async () => {
    setSaving(true);
    const record = {
      date: dateParam,
      total_income: totalIncome,
      total_expense: totalExpense,
      actual_income: actualIncome,
    };

    Object.keys(defaultData).forEach(k => {
      record[k] = parseFloat(data[k]) || 0;
    });

    if (editId) {
      await base44.entities.DailyRecord.update(editId, record);
      toast.success(t('updated'));
    } else {
      await base44.entities.DailyRecord.create(record);
      toast.success(t('saved'));
    }

    queryClient.invalidateQueries({ queryKey: ['dailyRecords'] });
    setSaving(false);
    navigate('/');
  };

  const handleDelete = async () => {
    if (!editId) return;
    if (!confirm(t('deleteConfirm'))) return;
    await base44.entities.DailyRecord.delete(editId);
    toast.success(t('deleted'));
    queryClient.invalidateQueries({ queryKey: ['dailyRecords'] });
    navigate('/');
  };

  return (
    <div className="px-5 pt-14 pb-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-5"
      >
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-muted-foreground">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">{t('back')}</span>
        </button>
        <h1 className="text-base font-bold text-foreground">
          {editId ? t('editRecord') : t('addTodayRecord')}
        </h1>
        {editId ? (
          <button onClick={handleDelete} className="text-destructive">
            <Trash2 className="w-5 h-5" />
          </button>
        ) : (
          <span className="w-10" />
        )}
      </motion.div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-5">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex-1">
            <div className={`h-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-border'}`} />
            <p className={`text-[10px] mt-1 text-center font-medium ${i <= step ? 'text-primary' : 'text-muted-foreground'}`}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-[400px]">
        {steps[step]}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        {step > 0 && (
          <Button
            variant="outline"
            onClick={() => setStep(s => s - 1)}
            className="flex-1 h-12 rounded-2xl font-semibold"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {t('back')}
          </Button>
        )}
        {step < steps.length - 1 ? (
          <Button
            onClick={() => setStep(s => s + 1)}
            className="flex-1 h-12 rounded-2xl font-semibold bg-primary hover:bg-primary/90"
          >
            {t('next')}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-12 rounded-2xl font-semibold bg-primary hover:bg-primary/90"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? '...' : t('save')}
          </Button>
        )}
      </div>
    </div>
  );
}