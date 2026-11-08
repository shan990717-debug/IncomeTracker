import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { actions } from '../lib/store';
import { sharedMode } from '../lib/supabase';
import { Empty, PrimaryButton } from '../components/ui';

/** /join/:code — open an invite link (after login) and land in that trip. */
export default function JoinPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (!sharedMode || started.current) return;
    started.current = true;
    actions.joinTrip(code)
      .then((id) => { toast.success('已加入旅行 🎉'); navigate(`/t/${id}`, { replace: true }); })
      .catch((e) => setError(e.message || '加入失败'));
  }, [code, navigate]);

  if (!sharedMode) return <Empty emoji="🔌" title="还没接上共用资料库">设定 Supabase 后，邀请链接才能用。</Empty>;
  return error ? (
    <Empty emoji="😕" title={error}>
      <PrimaryButton className="mt-4" onClick={() => navigate('/', { replace: true })}>回到首页</PrimaryButton>
    </Empty>
  ) : (
    <Empty emoji="🧳" title="正在加入旅行…" />
  );
}
