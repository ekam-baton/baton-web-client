import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { encryptPayload, decryptPayload } from '../../crypto';
import { toast } from '../../toast';

const generatePassword = (length=16, options={ upper:true, lower:true, num:true, sym:true }) => {
  let charset = "";
  if (options.upper) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (options.lower) charset += "abcdefghijklmnopqrstuvwxyz";
  if (options.num) charset += "0123456789";
  if (options.sym) charset += "!@#$%^&*()_+~`|}{[]:;?><,./-=";
  if (!charset) charset = "abcdefghijklmnopqrstuvwxyz";
  
  const array = new Uint32Array(length);
  window.crypto.getRandomValues(array);
  
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }
  return password;
};

export default function VaultDashboard({ masterKey, onLogout, timeoutMinutes, setTimeoutMinutes }) {
  const [encryptedVault, setEncryptedVault] = useState([]);
  const [decryptedItems, setDecryptedItems] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [newTitle, setNewTitle] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchAndDecryptVault() {
      if (!masterKey) return;
      try {
        const buffer = await api.downloadBackup();
        if (!buffer) {
          setEncryptedVault([]);
          setDecryptedItems([]);
          return;
        }
        
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(buffer);
        const parsed = JSON.parse(jsonString);
        
        let encryptedData;
        if (Array.isArray(parsed)) {
          encryptedData = parsed;
        } else {
          encryptedData = parsed.vault || [];
          if (parsed.last_modified) {
             localStorage.setItem('baton_last_modified', parsed.last_modified);
          }
        }
        
        setEncryptedVault(encryptedData);
        
        const decrypted = await Promise.all(encryptedData.map(async (encryptedItem) => {
          const plaintextObj = await decryptPayload(masterKey, encryptedItem.ciphertext, encryptedItem.iv);
          return plaintextObj ? { ...plaintextObj, _rawId: encryptedItem.id } : null;
        }));
        
        setDecryptedItems(decrypted.filter(item => item !== null));
      } catch (e) {
        console.error("Failed to sync vault", e);
      }
    }
    fetchAndDecryptVault();
  }, [masterKey]);

  const handleLogout = () => {
    api.logout();
    onLogout();
  };
  
  const uploadVault = async (updatedVault) => {
    try {
      let remoteLastModified = 0;
      try {
        const remoteBuffer = await api.downloadBackup();
        if (remoteBuffer) {
          const decoder = new TextDecoder();
          const parsed = JSON.parse(decoder.decode(remoteBuffer));
          if (parsed && parsed.last_modified) {
            remoteLastModified = parsed.last_modified;
          }
        }
      } catch {}
      
      const localLastModified = parseInt(localStorage.getItem('baton_last_modified')) || 0;
      if (remoteLastModified > localLastModified) {
        if (!window.confirm("Your vault was modified on another device. Do you want to overwrite it?")) {
           return false;
        }
      }
      
      const newLastModified = Date.now();
      const salt = localStorage.getItem('baton_user_salt') || '';
      const payload = {
        version: 2,
        salt: salt,
        last_modified: newLastModified,
        vault: updatedVault
      };
      
      const jsonString = JSON.stringify(payload);
      const encoder = new TextEncoder();
      const buffer = encoder.encode(jsonString);
      await api.uploadBackup(buffer);
      localStorage.setItem('baton_last_modified', newLastModified);
      return true;
    } catch (e) {
      console.error("Failed to upload backup to cloud", e);
      toast.error("Failed to sync to cloud: " + e.message);
      return false;
    }
  };

  const handleSaveNew = async (e) => {
    e.preventDefault();
    if (!newTitle || !newUsername || !newPassword) return;

    const plaintextObj = {
      id: editingId || Date.now(),
      title: newTitle,
      username: newUsername,
      password: newPassword,
      icon: newTitle.substring(0, 2).toUpperCase(),
      url: ''
    };

    const { ciphertext, iv } = await encryptPayload(masterKey, plaintextObj);
    const dbRecord = { id: plaintextObj.id, ciphertext, iv };

    let updatedVault;
    if (editingId) {
      updatedVault = encryptedVault.map(item => item.id === editingId ? dbRecord : item);
    } else {
      updatedVault = [...encryptedVault, dbRecord];
    }
    
    const success = await uploadVault(updatedVault);
    if (!success) return;

    setEncryptedVault(updatedVault);
    if (editingId) {
      setDecryptedItems(prev => prev.map(item => item.id === editingId ? { ...plaintextObj, _rawId: dbRecord.id } : item));
    } else {
      setDecryptedItems(prev => [...prev, { ...plaintextObj, _rawId: dbRecord.id }]);
    }
    
    toast.success(editingId ? "Credential updated!" : "Credential added!");
    closeForm();
  };
  
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this credential?")) return;
    const updatedVault = encryptedVault.filter(item => item.id !== id);
    const success = await uploadVault(updatedVault);
    if (!success) return;
    setEncryptedVault(updatedVault);
    setDecryptedItems(prev => prev.filter(item => item.id !== id));
    toast.success("Credential deleted!");
  };
  
  const openEdit = (item) => {
    setEditingId(item.id);
    setNewTitle(item.title);
    setNewUsername(item.username);
    setNewPassword(item.password);
    setIsAdding(true);
  };
  
  const closeForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setNewTitle('');
    setNewUsername('');
    setNewPassword('');
  };
  
  const filteredItems = decryptedItems.filter(item => {
    const q = searchQuery.toLowerCase();
    return (item.title || '').toLowerCase().includes(q) || 
           (item.username || '').toLowerCase().includes(q) ||
           (item.url || '').toLowerCase().includes(q);
  });

  return (
    <div style={{width: '100%', maxWidth: '800px', margin: '0 auto'}} className="animate-fade-in">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem'}}>
        <h2>Secure Vault</h2>
        <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
          <select 
            value={timeoutMinutes} 
            onChange={e => setTimeoutMinutes(parseInt(e.target.value) || 0)}
            style={{padding: '0.5rem', borderRadius: '8px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none'}}
          >
            <option value="1">Lock after 1 min</option>
            <option value="5">Lock after 5 min</option>
            <option value="15">Lock after 15 min</option>
            <option value="30">Lock after 30 min</option>
            <option value="0">Never Lock</option>
          </select>
          <button onClick={handleLogout} className="btn btn-outline" style={{padding: '0.5rem 1rem'}}>
            Lock Vault
          </button>
        </div>
      </div>

      {isAdding ? (
        <div className="glass" style={{padding: '2rem', marginBottom: '2rem'}}>
          <h3>{editingId ? "Edit Credential" : "Add New Credential"}</h3>
          <form onSubmit={handleSaveNew} style={{marginTop: '1.5rem'}}>
            <div className="input-group">
              <label>Title</label>
              <input className="input-field" value={newTitle} onChange={e => setNewTitle(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Username</label>
              <input className="input-field" value={newUsername} onChange={e => setNewUsername(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Password</label>
              <div style={{display: 'flex', gap: '0.5rem'}}>
                <input type="text" className="input-field" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                <button type="button" className="btn btn-outline" onClick={() => setNewPassword(generatePassword())}>Generate</button>
              </div>
            </div>
            <div style={{display: 'flex', gap: '1rem', marginTop: '1.5rem'}}>
              <button type="submit" className="btn btn-primary">{editingId ? "Save Changes" : "Encrypt & Save"}</button>
              <button type="button" className="btn btn-outline" onClick={closeForm}>Cancel</button>
            </div>
          </form>
        </div>
      ) : (
        <div className="glass" style={{padding: '2rem', minHeight: '60vh'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem'}}>
            <input 
              type="text" 
              className="input-field" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{width: '60%', marginBottom: 0}}
            />
            <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
              + New Password
            </button>
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
            {filteredItems.map(p => (
              <div key={p.id} style={{
                display: 'flex', 
                alignItems: 'center', 
                padding: '1rem', 
                background: 'var(--bg-secondary)',
                border: '1px solid transparent',
                borderRadius: '12px',
                transition: 'var(--transition-fast)',
              }} className="password-item">
                <div style={{
                  width: '42px', 
                  height: '42px', 
                  borderRadius: '10px', 
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  marginRight: '1rem'
                }}>
                  {p.icon}
                </div>
                <div style={{flexGrow: 1}}>
                  <div style={{fontWeight: 600, color: 'var(--text-primary)'}}>{p.title}</div>
                  <div style={{fontSize: '0.875rem', color: 'var(--text-muted)'}}>{p.username}</div>
                </div>
                <div style={{display: 'flex', gap: '0.5rem'}}>
                  <button 
                    className="btn btn-outline" 
                    style={{padding: '0.25rem 0.75rem', fontSize: '0.75rem'}}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(p);
                    }}
                  >
                    Edit
                  </button>
                  <button 
                    className="btn btn-outline" 
                    style={{padding: '0.25rem 0.75rem', fontSize: '0.75rem', color: 'var(--error)'}}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(p.id);
                    }}
                  >
                    Delete
                  </button>
                  <button 
                    className="btn btn-outline" 
                    style={{padding: '0.25rem 0.75rem', fontSize: '0.75rem'}}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(p.password);
                      toast.success('Password copied to clipboard!');
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            ))}
            
            {filteredItems.length === 0 && (
              <div style={{textAlign: 'center', padding: '3rem', color: 'var(--text-muted)'}}>
                {searchQuery ? "No results found." : "Your vault is empty."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
