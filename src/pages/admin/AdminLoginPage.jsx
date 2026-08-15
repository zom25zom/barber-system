import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { adminLogin, isAdmin } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (isAdmin) {
    navigate('/admin');
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    const result = adminLogin(password);
    if (result.success) {
      navigate('/admin');
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      position: 'relative',
      overflow: 'hidden',
      background: 'radial-gradient(circle at 25% 25%, rgba(194, 112, 61, 0.04) 0%, transparent 60%), var(--bg)'
    }}>
      {/* Decorative glow orbs */}
      <div style={{
        position: 'absolute', top: '-100px', right: '-100px',
        width: 500, height: 500,
        background: 'rgba(194, 112, 61, 0.04)',
        borderRadius: '50%',
        filter: 'blur(80px)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '-100px', left: '-100px',
        width: 400, height: 400,
        background: 'rgba(94, 140, 97, 0.04)',
        borderRadius: '50%',
        filter: 'blur(80px)',
        pointerEvents: 'none'
      }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 10 }}>
        {/* Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid rgba(194, 112, 61, 0.15)',
          borderRadius: 'var(--radius-xl)',
          padding: '2.5rem',
          boxShadow: '0 32px 64px rgba(0, 0, 0, 0.6)'
        }}>
          {/* Logo area */}
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{
              width: 72, height: 72,
              margin: '0 auto 1.25rem',
              borderRadius: 20,
              background: 'linear-gradient(135deg, var(--accent-hover), var(--accent))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(194, 112, 61, 0.25)',
            }}>
              <ShieldAlert style={{ width: 32, height: 32, color: '#000' }} />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              لوحة إدارة الصالون
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              منطقة محمية — خاصة بمالك الصالون
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: '1.5rem', padding: '0.875rem 1rem',
              background: 'rgba(181, 80, 74, 0.07)',
              border: '1px solid rgba(181, 80, 74, 0.2)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 700,
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="form-group">
            <div className="form-field">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <KeyRound style={{ width: 14, height: 14, color: 'var(--accent)' }} />
                كلمة مرور الإدارة
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ fontFamily: 'monospace', letterSpacing: '0.15em' }}
              />
            </div>

            <button type="submit" className="gold-gradient-bg" style={{ width: '100%', padding: '1rem', fontSize: '0.95rem', marginTop: '0.5rem' }}>
              الدخول للوحة التحكم
            </button>
          </form>

          {/* Demo password hint */}
          <div style={{
            marginTop: '2rem',
            padding: '1rem',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>كلمة المرور الافتراضية للتجربة</p>
            <code style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--accent)', letterSpacing: '0.1em' }}>admin123</code>
          </div>
        </div>
      </div>
    </div>
  );
}
