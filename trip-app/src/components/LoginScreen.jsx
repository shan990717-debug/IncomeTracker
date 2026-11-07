import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { PrimaryButton, inputCls } from './ui';

/**
 * Email login with a one-time link (no password to remember). The link brings
 * the user back to the page they were on, so an invite link still works.
 */
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const inviting = window.location.pathname.startsWith('/join/');

  const send = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.href },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else setSent(true);
  };

  return (
    <div className="min-h-screen max-w-sm mx-auto px-6 flex flex-col justify-center gap-6">
      <div className="text-center space-y-2">
        <img src="/icon.svg" alt="" className="w-16 h-16 mx-auto" />
        <h1 className="text-2xl font-black">tripaa</h1>
        <p className="text-sm text-muted-foreground">
          {inviting ? '旅伴邀请你一起整理攻略，先登录一下。' : '和旅伴一起收集 IG、小红书的攻略，整理出发前要准备的事。'}
        </p>
      </div>
      {sent ? (
        <div className="rounded-2xl border border-border bg-card p-5 text-center space-y-2">
          <Mail className="w-8 h-8 text-primary mx-auto" />
          <p className="font-bold">登录链接已寄到 {email}</p>
          <p className="text-xs text-muted-foreground">打开邮件点链接就会登录。没收到的话看看垃圾邮件。</p>
          <button onClick={() => setSent(false)} className="text-xs text-primary font-semibold pt-1">换一个邮箱</button>
        </div>
      ) : (
        <div className="space-y-3">
          <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && /\S+@\S+/.test(email) && send()}
            className={inputCls} placeholder="你的邮箱" />
          <PrimaryButton disabled={!/\S+@\S+\.\S+/.test(email) || busy} onClick={send}>{busy ? '寄送中…' : '寄登录链接给我'}</PrimaryButton>
          <p className="text-[11px] text-muted-foreground text-center">不用密码，每次点邮件里的链接就能登录。</p>
        </div>
      )}
    </div>
  );
}
