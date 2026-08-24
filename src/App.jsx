import React, { useState, useEffect } from 'react'
import AuthFlow from './components/Auth/AuthFlow'
import VaultDashboard from './components/Vault/VaultDashboard'
import { toast } from './toast'
import './App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [masterKey, setMasterKey] = useState(null);

  useEffect(() => {
    // Check if token exists on load
    if (localStorage.getItem('baton_token')) {
      setIsAuthenticated(true);
    }
  }, []);

  const [toasts, setToasts] = useState([]);
  const [timeoutMinutes, setTimeoutMinutes] = useState(
    () => parseInt(localStorage.getItem('baton_timeout')) || 5
  );

  useEffect(() => {
    const handler = (e) => {
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { ...e.detail, id }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
    };
    window.addEventListener('toast', handler);
    return () => window.removeEventListener('toast', handler);
  }, []);

  useEffect(() => {
    if (!masterKey || timeoutMinutes === 0) return;
    
    let timer;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        handleLogout();
        toast.info("Vault locked due to inactivity.");
      }, timeoutMinutes * 60 * 1000);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [masterKey, timeoutMinutes]);

  const handleLogout = () => {
    setIsAuthenticated(false);
    setMasterKey(null);
  };

  return (
    <div className="app-container">
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
      {!isAuthenticated || !masterKey ? (
        <AuthFlow 
          onAuthenticated={(key) => {
            setMasterKey(key);
            setIsAuthenticated(true);
          }} 
        />
      ) : (
        <VaultDashboard 
          masterKey={masterKey} 
          onLogout={handleLogout} 
          timeoutMinutes={timeoutMinutes}
          setTimeoutMinutes={(val) => {
            setTimeoutMinutes(val);
            localStorage.setItem('baton_timeout', val);
          }}
        />
      )}
    </div>
  )
}

export default App
