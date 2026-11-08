import React, { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { PrimaryButton, inputCls } from './ui';

/*
 * Email + password login. With Supabase's "Confirm email" turned off, signing
 * up logs you in straight away (no email to click). If it's still on, we say
 * so instead of failing silently.
 */

const ERRORS = [
  [/invalid login credentials/i, '邮箱或密码不对'],
  [/already registered|already exists/i, '这个邮箱已经注册过，请直接登录'],
  [/email not confirmed/i, '这个账号还没验证邮箱。请在 Supabase 关掉「Confirm email」，或先点邮件里的验证链接'],
  [/password should be at least/i, '密码至少 6 个字'],
  [/rate limit|too many/i, '试太多次了，等一下再试'],
];
const friendly = (msg = '') => ERRORS.find(([re]) => re.test(msg))?.[1] || msg;

export default function LoginScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const inviting = window.location.pathname.startsWith('/join/');
  const validEmail = /\S+@\S+\.\S+/.test(email.trim());
  const valid = validEmail && password.length >= 6 && (mode === 'login' || name.trim());

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() }, emailRedirectTo: window.location.href },
        });
        if (error) throw error;
        // No session back means Supabase still requires email confirmation.
        if (!data.session) toast.message('账号已建立，但 Supabase 还开着「Confirm email」：请先点邮件里的链接，或在后台关掉它。', { duration: 8000 });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (e) {
      toast.error(friendly(e.message));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!validEmail) return toast('先在上面填你的邮箱');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    if (error) toast.error(friendly(error.message));
    else toast.success('重设密码的链接已寄到你的邮箱');
  };

  return (
    <div className="min-h-screen max-w-sm mx-auto px-6 flex flex-col justify-center gap-6">
      <div className="text-center space-y-2">
        <img src="/icon.svg" alt="" className="w-16 h-16 mx-auto" />
        <h1 className="text-2xl font-black">tripaa</h1>
        <p className="text-sm text-muted-foreground">
          {inviting ? '旅伴邀请你一起整理攻略，先登录或注册一下。' : '和旅伴一起收集 IG、小红书的攻略，整理出发前要准备的事。'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
        {[['login', '登录'], ['signup', '注册']].map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`rounded-xl py-2 text-sm font-bold transition ${mode === m ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {mode === 'signup' && (
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname"
            className={inputCls} placeholder="名字（旅伴会看到）" />
        )}
        <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className={inputCls} placeholder="邮箱" />
        <input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password}
          onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder={mode === 'signup' ? '设一个密码（至少 6 个字）' : '密码'} />
        <PrimaryButton type="submit" disabled={!valid || busy}>
          {busy ? '请稍等…' : mode === 'signup' ? '注册并进入' : '登录'}
        </PrimaryButton>
      </form>

      {mode === 'login' && (
        <button onClick={forgot} className="text-xs text-muted-foreground font-semibold">忘记密码？</button>
      )}
    </div>
  );
}

/** Shown after opening a password-reset link. */
export function NewPasswordScreen({ onDone }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(friendly(error.message));
    toast.success('密码已更新');
    onDone();
  };
  return (
    <div className="min-h-screen max-w-sm mx-auto px-6 flex flex-col justify-center gap-4">
      <h1 className="text-xl font-black text-center">设定新密码</h1>
      <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
        className={inputCls} placeholder="新密码（至少 6 个字）" />
      <PrimaryButton disabled={password.length < 6 || busy} onClick={save}>{busy ? '请稍等…' : '保存'}</PrimaryButton>
    </div>
  );
}
