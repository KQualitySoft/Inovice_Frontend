import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import logo from '../assets/logo.png';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setVerifying(false);
        setTokenValid(false);
        setVerifyError('Missing password reset token. Please request a new reset link.');
        return;
      }

      try {
        const res = await authApi.verifyResetToken(token, emailParam);
        if (res && res.valid) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
          setVerifyError(res?.error || 'Invalid or expired password reset link. Please request a new one.');
        }
      } catch (err) {
        setTokenValid(false);
        setVerifyError(err.message || 'Unable to verify reset token. Please try again.');
      } finally {
        setVerifying(false);
      }
    }

    verifyToken();
  }, [token, emailParam]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 4) {
      setFormError('Password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setFormError('');
    setSubmitting(true);

    try {
      await authApi.resetPassword(token, newPassword, emailParam);
      setResetSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      console.error('Reset password error:', err);
      setFormError(err.message || 'Failed to reset password. Please request a new link.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="login-container" style={{ maxWidth: '420px', width: '100%' }}>
        <div className="logo">
          <img src={logo} alt="Quality SalesPro Logo" />
        </div>

        <h1 className="title">Set New Password</h1>

        {verifying ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '12px', color: '#7b3fe4' }}></i>
            <p style={{ fontSize: '14px', margin: 0 }}>Verifying your reset link...</p>
          </div>
        ) : !tokenValid ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#fef2f2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              margin: '0 auto 16px auto'
            }}>
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
              Reset Link Expired or Invalid
            </h3>
            <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: '1.6', marginBottom: '22px' }}>
              {verifyError}
            </p>
            <Link
              to="/forgot-password"
              className="login-btn"
              style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
            >
              Request New Link
            </Link>
          </div>
        ) : resetSuccess ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#ecfdf5',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              margin: '0 auto 16px auto'
            }}>
              <i className="fa-solid fa-circle-check"></i>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
              Password Reset Complete!
            </h3>
            <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: '1.6', marginBottom: '20px' }}>
              Your password has been securely updated. Redirecting you to login...
            </p>
            <Link
              to="/login"
              className="login-btn"
              style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
            >
              Sign In Now
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748b', marginTop: '2px', marginBottom: '20px' }}>
              Please enter your new password below.
            </p>

            <div className="input-group">
              <label htmlFor="newPasswordInput">New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="newPasswordInput"
                  placeholder="Enter new password"
                  style={{ paddingRight: '40px' }}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (formError) setFormError('');
                  }}
                  required
                />
                <i
                  className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer',
                    color: '#64748b',
                  }}
                  onClick={() => setShowPassword((prev) => !prev)}
                ></i>
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="confirmPasswordInput">Confirm New Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirmPasswordInput"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (formError) setFormError('');
                }}
                required
              />
            </div>

            {formError && (
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  marginBottom: '14px',
                  textAlign: 'center'
                }}
              >
                <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '6px' }}></i>
                {formError}
              </div>
            )}

            <button type="submit" className="login-btn" disabled={submitting}>
              {submitting ? (
                <span>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Updating Password...
                </span>
              ) : (
                'Save New Password'
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '18px' }}>
              <Link to="/login" style={{ color: '#7b3fe4', fontSize: '13.5px', fontWeight: '600', textDecoration: 'none' }}>
                <i className="fa-solid fa-arrow-left" style={{ marginRight: '6px' }}></i> Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
