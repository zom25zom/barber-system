import React, { useState } from 'react';
import { Phone, User, ShieldCheck, X, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function OtpModal({ isOpen, onClose, onSuccess }) {
  const { customerLogin } = useAuth();
  const [step, setStep] = useState('INFO'); // 'INFO' | 'CONFIRM'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleNext = (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('يرجى كتابة الاسم الكامل'); return; }
    if (!phone.trim() || phone.replace(/\s/g, '').length < 8) {
      setError('يرجى إدخال رقم هاتف صحيح');
      return;
    }
    setError('');
    setStep('CONFIRM');
  };

  const handleConfirm = () => {
    const session = customerLogin(name, phone.trim());
    onSuccess(session);
  };

  const handleClose = () => {
    setStep('INFO');
    setName('');
    setPhone('');
    setError('');
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ position: 'relative', maxWidth: 420 }}>

        {/* Close */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute', top: '1rem', left: '1rem',
            width: 32, height: 32, borderRadius: 9,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#64748b', transition: 'all 0.2s'
          }}
        >
          <X style={{ width: 15, height: 15 }} />
        </button>

        {/* ══════════ STEP 1: Enter info ══════════ */}
        {step === 'INFO' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div style={{
                width: 60, height: 60, margin: '0 auto 1rem',
                borderRadius: 16,
                background: 'rgba(194, 112, 61, 0.1)',
                border: '1px solid rgba(194, 112, 61, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <ShieldCheck style={{ width: 26, height: 26, color: 'var(--accent)' }} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc', marginBottom: '0.4rem' }}>
                تسجيل الدخول / إنشاء حساب
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.6 }}>
                أدخل اسمك ورقم جوالك لإكمال الحجز وتتبع دورك في الطابور
              </p>
            </div>

            {error && (
              <div style={{
                marginBottom: '1rem', padding: '0.75rem 1rem',
                background: 'rgba(181, 80, 74, 0.07)',
                border: '1px solid rgba(181, 80, 74, 0.2)',
                borderRadius: 12,
                color: '#f43f5e', fontSize: '0.78rem', fontWeight: 700, textAlign: 'center'
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleNext} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <User style={{ width: 13, height: 13 }} />
                  الاسم الكامل
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="مثال: محمد عبدالله"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Phone style={{ width: 13, height: 13 }} />
                  رقم الجوال
                </label>
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="0500000000"
                  style={{ textAlign: 'right' }}
                />
              </div>

              <button
                type="submit"
                style={{
                  marginTop: '0.5rem',
                  width: '100%', padding: '0.95rem',
                  background: 'linear-gradient(135deg, #f5df99, var(--accent))',
                  border: 'none', borderRadius: 12,
                  color: '#000', fontWeight: 800, fontSize: '0.9rem',
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 4px 14px rgba(194, 112, 61, 0.25)',
                  transition: 'all 0.2s'
                }}
              >
                متابعة
              </button>
            </form>
          </>
        )}

        {/* ══════════ STEP 2: Confirmation ══════════ */}
        {step === 'CONFIRM' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div style={{
                width: 60, height: 60, margin: '0 auto 1rem',
                borderRadius: 16,
                background: 'rgba(94, 140, 97, 0.1)',
                border: '1px solid rgba(94, 140, 97, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <CheckCircle2 style={{ width: 28, height: 28, color: '#10b981' }} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f8fafc', marginBottom: '0.75rem' }}>
                تأكيد البيانات
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.7, marginBottom: '0.25rem' }}>
                هل المعلومات التالية صحيحة؟
              </p>
            </div>

            {/* Info card */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14,
              padding: '1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>الاسم</span>
                <span style={{ color: '#f8fafc', fontWeight: 800 }}>{name}</span>
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>رقم الجوال</span>
                <span style={{ color: 'var(--accent)', fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.05em' }} dir="ltr">
                  {phone}
                </span>
              </div>
            </div>

            {/* Confirm */}
            <button
              onClick={handleConfirm}
              style={{
                width: '100%', padding: '0.95rem',
                background: 'linear-gradient(135deg, #f5df99, var(--accent))',
                border: 'none', borderRadius: 12,
                color: '#000', fontWeight: 800, fontSize: '0.9rem',
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 14px rgba(194, 112, 61, 0.25)',
                marginBottom: '0.625rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
              }}
            >
              <CheckCircle2 style={{ width: 18, height: 18 }} />
              نعم، البيانات صحيحة — إنشاء الحساب
            </button>

            {/* Edit */}
            <button
              onClick={() => setStep('INFO')}
              style={{
                width: '100%', padding: '0.75rem',
                background: 'transparent', border: 'none',
                color: '#64748b', fontSize: '0.8rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'color 0.2s'
              }}
            >
              ← تعديل البيانات
            </button>
          </>
        )}
      </div>
    </div>
  );
}
