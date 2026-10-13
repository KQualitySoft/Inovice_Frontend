import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

export default function UpdateCredentials() {
  const { userEmail, updateCredentials, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [isError, setIsError] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="logo">
          <img src={logo} alt="KQualitySoft Logo" />
        </div>
        <h1 className="title">Please Login First</h1>
        <div className="create-Account">
          <Link to="/login">Go to Login</Link>
        </div>
        <div className="create-Account" style={{ marginTop: '8px' }}>
          <Link to="/forgot-password" style={{ color: '#7b3fe4', fontSize: '13px' }}>Forgot Password?</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newEmail && !newPassword) {
      alert('Please provide a new email or password to update.');
      return;
    }

    setLoading(true);
    setMsg('');
    setIsError(false);

    try {
      await updateCredentials(newEmail || undefined, newPassword || undefined);
      setMsg('Credentials updated successfully!');
      setNewEmail('');
      setNewPassword('');
    } catch (err) {
      console.error('Update credentials error:', err);
      setIsError(true);
      setMsg(err.message || 'Failed to update credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="login-container">
        <div className="logo">
          <img src={logo} alt="KQualitySoft Logo" />
        </div>

        <h1 className="title">Update Credentials</h1>

        <form id="updateForm" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Current Email</label>
            <input
              type="email"
              id="currentEmail"
              placeholder="Enter current email"
              value={userEmail}
              readOnly
            />
          </div>

          <div className="input-group">
            <label>New Email (Optional)</label>
            <input
              type="email"
              id="newEmail"
              placeholder="Enter new email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>New Password (Optional)</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="newPassword"
                placeholder="Enter new password"
                style={{ paddingRight: '40px' }}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
          </div>

          {msg && (
            <p
              style={{
                color: isError ? 'red' : 'green',
                fontSize: '14px',
                textAlign: 'center',
                marginBottom: '10px',
              }}
            >
              {msg}
            </p>
          )}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Updating...' : 'Update'}
          </button>

          <div className="create-Account">
            <Link to="/dashboard">Back to Dashboard</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
