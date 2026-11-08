import React, { useEffect, useState } from 'react';
import { LogOut, Check } from 'lucide-react';
import { toast } from 'sonner';
import { actions, myName } from '../lib/store';
import { sharedMode } from '../lib/supabase';
import { Sheet, Field, inputCls } from './ui';

/** Round initial used in the header and here. */
export function Avatar({ name, className = 'w-9 h-9 text-sm' }) {
  return (
    <span className={`rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0 ${className}`}>
      {(name || '?').slice(0, 1).toUpperCase()}
    </span>
  );
}

/** 我的账号: name shown to 旅伴, email, sign out. */
export default function AccountSheet({ open, onClose, state }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setName(myName()); }, [open]);

  const saveName = async () => {
    if (!name.trim() || name.trim() === myName()) return;
    setSaving(true);
    try { await actions.setMyName(name.trim()); toast.success('名字已更新'); } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const signOut = async () => {
    if (!window.confirm('确定要登出吗？')) return;
    onClose();
    await actions.signOut();
  };

  return (
    <Sheet open={open} onClose={onClose} title="我的账号">
      {sharedMode ? (
        <div className="space-y-5 pb-2">
          <div className="flex items-center gap-3">
            <Avatar name={myName()} className="w-14 h-14 text-xl" />
            <div className="min-w-0">
              <p className="font-bold text-lg truncate">{myName()}</p>
              <p className="text-xs text-muted-foreground truncate">{state.user?.email}</p>
            </div>
          </div>
          <Field label="旅伴看到的名字">
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              <button onClick={saveName} disabled={saving || !name.trim() || name.trim() === myName()}
                className="shrink-0 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-30" aria-label="保存名字">
                <Check className="w-4 h-4" />
              </button>
            </div>
          </Field>
          <button onClick={signOut}
            className="w-full rounded-xl border border-border py-3 text-sm font-bold text-destructive flex items-center justify-center gap-2">
            <LogOut className="w-4 h-4" /> 登出
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground pb-4">
          现在是试用模式：资料只存在这台设备上，没有账号。设定好 Supabase 后就会出现登录。
        </p>
      )}
    </Sheet>
  );
}
