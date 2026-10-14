import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [identifierError, setIdentifierError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    let valid = true;
    if (!identifier.trim()) {
      setIdentifierError(true);
      valid = false;
    } else {
      setIdentifierError(false);
    }

    if (!password) {
      setPasswordError(true);
      valid = false;
    } else {
      setPasswordError(false);
    }

    if (!valid) return;

    setServerError('');
    setLoading(true);

    try {
      await login(identifier.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      const msg = err.message === 'Failed to fetch'
        ? 'Cannot connect to backend server. Please check server connection.'
        : (err.message || 'Invalid credentials.');
      setServerError(msg);
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

        <h1 className="title">Account Login</h1>
        <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748b', marginTop: '6px', marginBottom: '18px' }}>
          Enter your username or email and password to access Quality SalesPro
        </p>

        <form id="loginForm" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="identifier">Email or Username</label>
            <input
              type="text"
              id="identifier"
              placeholder="e.g. admin or john"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (identifierError) setIdentifierError(false);
              }}
              required
            />
            {identifierError && <small style={{ color: '#dc2626' }}>Email or username is required</small>}
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder="Enter password"
                style={{ paddingRight: '40px' }}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(false);
                }}
                required
              />
              <i
                className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}
                id="togglePassword"
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
            {passwordError && <small style={{ color: '#dc2626' }}>Password is required</small>}
          </div>

          <div className="forgot">
            <Link to="/forgot-password">Forgot Password?</Link>
          </div>

          {serverError && (
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
              {serverError}
            </div>
          )}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>


        </form>
      </div>
    </div>
  );
}
