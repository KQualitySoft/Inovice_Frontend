import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../services/api';
import userService from '../services/userService';
import logo from '../assets/logo.png';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      await authApi.forgotPassword(cleanEmail);
      setSubmitted(true);
    } catch (err) {
      console.error('Forgot password error:', err);
      const isNetworkErr = !err.status || err.message?.includes('fetch') || err.message?.includes('NetworkError') || err.message?.includes('Failed to fetch');
      if (isNetworkErr) {
        const localUser = userService.findUserByLogin(cleanEmail);
        if (localUser) {
          setSubmitted(true);
          return;
        }
        setErrorMsg('Unable to connect to the server. Please check your network connection.');
        return;
      }
      setErrorMsg(err.message || 'Unable to process your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="login-container" style={{ maxWidth: '420px', width: '100%' }}>
        <div className="logo">
          <img src={logo} alt="Quality SalesPro Logo" />
        </div>

        <h1 className="title">Forgot Password</h1>
        <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748b', marginTop: '6px', marginBottom: '22px' }}>
          Enter your registered email address and we'll send you a secure password reset link.
        </p>

        {submitted ? (
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
              <i className="fa-solid fa-envelope-circle-check"></i>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
              Check Your Inbox
            </h3>
            <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: '1.6', marginBottom: '20px' }}>
              If an account is associated with <strong>{email}</strong>, a password reset link has been dispatched.
              Please check your inbox and click the link to set a new password.
            </p>
            <Link
              to="/login"
              className="login-btn"
              style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="resetEmail">Registered Email Address</label>
              <input
                type="email"
                id="resetEmail"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                required
              />
            </div>

            {errorMsg && (
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
                {errorMsg}
              </div>
            )}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? (
                <span>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Sending Link...
                </span>
              ) : (
                'Send Reset Link'
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
