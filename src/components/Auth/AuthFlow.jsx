import React, { useState } from 'react';
import { api } from '../../api';
import { deriveMasterKey, generateSalt } from '../../crypto';

export default function AuthFlow({ onAuthenticated }) {
  const [view, setView] = useState('login'); // login, register, verify
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const performLoginFlow = async () => {
    let salt = localStorage.getItem('baton_user_salt');
    try {
      const buffer = await api.downloadBackup();
      if (buffer) {
        const decoder = new TextDecoder();
        const parsed = JSON.parse(decoder.decode(buffer));
        if (parsed && parsed.salt) {
          salt = parsed.salt;
          localStorage.setItem('baton_user_salt', salt);
        }
      }
    } catch(e) {}
    
    if (!salt) {
      throw new Error("Unable to retrieve encryption salt for this account.");
    }
    
    const key = await deriveMasterKey(password, salt);
    onAuthenticated(key);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.login(email, password);
      await performLoginFlow();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.register(email, password);
      const salt = generateSalt();
      localStorage.setItem('baton_user_salt', salt);
      setView('verify');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.verifyOTP(email, code);
      // After verification, login
      await api.login(email, password);
      
      const salt = localStorage.getItem('baton_user_salt');
      if (salt) {
        // Initial empty backup so salt is stored in cloud
        const payload = {
          version: 2,
          salt: salt,
          last_modified: Date.now(),
          vault: []
        };
        const buffer = new TextEncoder().encode(JSON.stringify(payload));
        await api.uploadBackup(buffer);
      }
      
      await performLoginFlow();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card glass animate-fade-in">
      <div className="card-header">
        <h1 className="card-title">Baton</h1>
        <p className="card-subtitle">Zero-Trust Identity</p>
      </div>
      
      {error && <div style={{color: 'var(--error)', marginBottom: '1rem', fontSize: '0.875rem'}}>{error}</div>}
      
      {view === 'login' && (
        <form onSubmit={handleLogin} style={{width: '100%'}}>
          <div className="input-group">
            <label>Email Address</label>
            <input 
              type="email" 
              className="input-field" 
              placeholder="agent@baton.io" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="input-group">
            <label>Master Password</label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{width: '100%', marginTop: '1rem'}} disabled={loading}>
            {loading ? 'Decrypting...' : 'Access Vault'}
          </button>
          
          <div style={{marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)'}}>
            Don't have an account? <span style={{color: 'var(--accent-primary)', cursor: 'pointer'}} onClick={() => setView('register')}>Create one</span>
          </div>
        </form>
      )}

      {view === 'register' && (
        <form onSubmit={handleRegister} style={{width: '100%'}}>
          <div className="input-group">
            <label>Email Address</label>
            <input 
              type="email" 
              className="input-field" 
              placeholder="agent@baton.io" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="input-group">
            <label>Master Password</label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="Extremely strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
            <p style={{fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px'}}>
              If you lose this password, nobody can recover your data. Not even us.
            </p>
          </div>
          <button type="submit" className="btn btn-primary" style={{width: '100%', marginTop: '1rem'}} disabled={loading}>
            {loading ? 'Generating Keys...' : 'Create Secure Vault'}
          </button>
          
          <div style={{marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)'}}>
            Already have an account? <span style={{color: 'var(--accent-primary)', cursor: 'pointer'}} onClick={() => setView('login')}>Sign in</span>
          </div>
        </form>
      )}

      {view === 'verify' && (
        <form onSubmit={handleVerify} style={{width: '100%'}}>
          <p style={{marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem'}}>
            We sent a secure code to <strong>{email}</strong>.
          </p>
          <div className="input-group">
            <label>Verification Code</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="000000"
              style={{letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.25rem'}}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required 
              maxLength={6}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{width: '100%', marginTop: '1rem'}} disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Device'}
          </button>
        </form>
      )}
    </div>
  );
}
