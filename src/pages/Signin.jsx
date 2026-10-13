import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

export default function Signin() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    let valid = true;

    if (!email.trim()) {
      setEmailError('Email is required');
      valid = false;
    } else {
      setEmailError('');
    }

    if (!password) {
      setPasswordError('Password is required');
      valid = false;
    } else {
      setPasswordError('');
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      valid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      valid = false;
    } else {
      setConfirmPasswordError('');
    }

    if (!valid) return;

    setServerError('');
    setLoading(true);

    try {
      await signup(email.trim(), password);
      alert('Account created successfully!');
      navigate('/login');
    } catch (err) {
      console.error('Signup error:', err);
      setServerError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="signin-container">
        <div className="logo">
          <img src={logo} alt="KQualitySoft Logo" />
        </div>

        <h1 className="title">Sign In to Your Account</h1>

        <form id="signinForm" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              id="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError('');
              }}
              required
            />
            {emailError && <small id="emailError" style={{ color: 'red' }}>{emailError}</small>}
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
                  if (passwordError) setPasswordError('');
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
                  color: '#555',
                }}
                onClick={() => setShowPassword((prev) => !prev)}
              ></i>
            </div>
            {passwordError && <small id="passwordError" style={{ color: 'red' }}>{passwordError}</small>}
          </div>

          <div className="input-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                placeholder="Confirm password"
                style={{ paddingRight: '40px' }}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (confirmPasswordError) setConfirmPasswordError('');
                }}
                required
              />
              <i
                className={`fa ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}
                id="toggleConfirmPassword"
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'pointer',
                  color: '#555',
                }}
                onClick={() => setShowConfirmPassword((prev) => !prev)}
              ></i>
            </div>
            {confirmPasswordError && (
              <small id="confirmPasswordError" style={{ color: 'red' }}>
                {confirmPasswordError}
              </small>
            )}
          </div>

          {serverError && (
            <p style={{ color: 'red', fontSize: '14px', textAlign: 'center', marginBottom: '10px' }}>
              {serverError}
            </p>
          )}

          <button type="submit" className="signin-btn" disabled={loading}>
            {loading ? 'Creating Account...' : 'Sign In'}
          </button>

          <div className="create-Account">
            <Link to="/login">Already have an account? Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
