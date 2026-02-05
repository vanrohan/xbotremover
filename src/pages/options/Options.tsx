import React, { useState, useEffect } from 'react';
import { TechnicalSettings, StorageData } from '../../types/extension';
import { ALL_COUNTRIES, PREDEFINED_SETS } from '../../data/countries';
import './Options.css';

const defaultSettings: TechnicalSettings = {
  scrollDelay: 250,
  actionDelay: 450,
  hoverDelay: 350,
  profileLoadDelay: 2000,
  maxFollowerAttempts: 3,
  maxHoverAttempts: 5,
  maxScrollAttempts: 5
};

export default function Options() {
  const [settings, setSettings] = useState<TechnicalSettings>(defaultSettings);
  const [usernamesToRemove, setUsernamesToRemove] = useState<string>('');
  const [blacklistedCountries, setBlacklistedCountries] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('');

  useEffect(() => {
    loadSettings();
    loadUsernames();
    loadBlacklistedCountries();
  }, []);

  const loadSettings = () => {
    chrome.storage.sync.get(defaultSettings, (items) => {
      setSettings(items as TechnicalSettings);
    });
  };

  const loadUsernames = () => {
    chrome.storage.local.get(['usernamesToRemove'], (result) => {
      if (result.usernamesToRemove) {
        setUsernamesToRemove(result.usernamesToRemove);
      }
    });
  };

  const loadBlacklistedCountries = () => {
    chrome.storage.local.get(['blacklistedCountries'], (result) => {
      if (result.blacklistedCountries) {
        setBlacklistedCountries(result.blacklistedCountries);
      }
    });
  };

  const saveSettings = () => {
    chrome.storage.sync.set(settings, () => {
      showMessage('Settings saved successfully!', 'success');
    });
  };

  const resetSettings = () => {
    chrome.storage.sync.set(defaultSettings, () => {
      setSettings(defaultSettings);
      showMessage('Settings reset to defaults!', 'success');
    });
  };

  const handleUsernamesChange = (value: string) => {
    setUsernamesToRemove(value);
    
    const usernames = value.split(/[\s,]+/)
      .map(u => u.trim())
      .filter(u => u)
      .join(', ');
    
    chrome.storage.local.set({
      usernamesToRemove: usernames
    }, () => {
      showMessage('Usernames saved successfully!', 'success');
    });
  };

  const showMessage = (message: string, type: 'success' | 'error') => {
    setStatusMessage(message);
    setStatusType(type);
    setTimeout(() => {
      setStatusMessage('');
      setStatusType('');
    }, 3000);
  };

  const handleSettingChange = (key: keyof TechnicalSettings, value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleCountryToggle = (country: string) => {
    setBlacklistedCountries(prev => {
      const newList = prev.includes(country)
        ? prev.filter(c => c !== country)
        : [...prev, country];
      chrome.storage.local.set({ blacklistedCountries: newList }, () => {
        showMessage('Countries updated!', 'success');
      });
      return newList;
    });
  };

  const handlePredefinedSetSelect = (setName: string) => {
    const countries = PREDEFINED_SETS[setName as keyof typeof PREDEFINED_SETS] || [];
    setBlacklistedCountries(prev => {
      const newList = [...new Set([...prev, ...countries])];
      chrome.storage.local.set({ blacklistedCountries: newList }, () => {
        showMessage(`${setName} countries selected!`, 'success');
      });
      return newList;
    });
  };

  const handleClearAllCountries = () => {
    setBlacklistedCountries([]);
    chrome.storage.local.set({ blacklistedCountries: [] }, () => {
      showMessage('All countries cleared!', 'success');
    });
  };

  return (
    <div className="container">
      <h1>X Bot Remover - Technical Settings</h1>
      <p className="warning">
        Only modify these settings if you understand their impact on the extension's functionality.
      </p>

      <div className="settings-group">
        <h2>Timing Delays (milliseconds)</h2>
        <div className="setting">
          <label htmlFor="scrollDelay">Scroll Delay:</label>
          <input
            type="number"
            id="scrollDelay"
            min="100"
            max="2000"
            value={settings.scrollDelay}
            onChange={(e) => handleSettingChange('scrollDelay', parseInt(e.target.value))}
          />
          <span className="help-text">Time to wait after scrolling (default: 250)</span>
        </div>
        <div className="setting">
          <label htmlFor="actionDelay">Action Delay:</label>
          <input
            type="number"
            id="actionDelay"
            min="300"
            max="2000"
            value={settings.actionDelay}
            onChange={(e) => handleSettingChange('actionDelay', parseInt(e.target.value))}
          />
          <span className="help-text">Time between major actions (default: 450)</span>
        </div>
        <div className="setting">
          <label htmlFor="hoverDelay">Hover Delay:</label>
          <input
            type="number"
            id="hoverDelay"
            min="200"
            max="1000"
            value={settings.hoverDelay}
            onChange={(e) => handleSettingChange('hoverDelay', parseInt(e.target.value))}
          />
          <span className="help-text">Time to wait for hover card to appear (default: 350)</span>
        </div>
        <div className="setting">
          <label htmlFor="profileLoadDelay">Profile Load Delay:</label>
          <input
            type="number"
            id="profileLoadDelay"
            min="1000"
            max="5000"
            value={settings.profileLoadDelay}
            onChange={(e) => handleSettingChange('profileLoadDelay', parseInt(e.target.value))}
          />
          <span className="help-text">Time to wait for profile page to load (default: 2000)</span>
        </div>
      </div>

      <div className="settings-group">
        <h2>Retry Settings</h2>
        <div className="setting">
          <label htmlFor="maxFollowerAttempts">Max Follower Find Attempts:</label>
          <input
            type="number"
            id="maxFollowerAttempts"
            min="1"
            max="10"
            value={settings.maxFollowerAttempts}
            onChange={(e) => handleSettingChange('maxFollowerAttempts', parseInt(e.target.value))}
          />
          <span className="help-text">Maximum attempts to find next follower (default: 3)</span>
        </div>
        <div className="setting">
          <label htmlFor="maxHoverAttempts">Max Hover Card Attempts:</label>
          <input
            type="number"
            id="maxHoverAttempts"
            min="1"
            max="10"
            value={settings.maxHoverAttempts}
            onChange={(e) => handleSettingChange('maxHoverAttempts', parseInt(e.target.value))}
          />
          <span className="help-text">Maximum attempts to load hover card (default: 5)</span>
        </div>
        <div className="setting">
          <label htmlFor="maxScrollAttempts">Max Scroll Attempts:</label>
          <input
            type="number"
            id="maxScrollAttempts"
            min="1"
            max="10"
            value={settings.maxScrollAttempts}
            onChange={(e) => handleSettingChange('maxScrollAttempts', parseInt(e.target.value))}
          />
          <span className="help-text">Maximum attempts to find new followers by scrolling (default: 5)</span>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="usernamesToRemove">Usernames to Remove (comma-separated):</label>
        <textarea
          id="usernamesToRemove"
          rows={4}
          placeholder="Enter usernames to remove (e.g., user1, user2, user3)"
          value={usernamesToRemove}
          onChange={(e) => handleUsernamesChange(e.target.value)}
        />
        <small className="help-text">
          These users will be removed regardless of other criteria. One username per line or comma-separated.
        </small>
      </div>

      <div className="form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <label htmlFor="blacklistedCountries">Blacklisted Countries:</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleClearAllCountries}
              style={{ padding: '5px 10px', fontSize: '0.9em', background: '#E76F51' }}
            >
              Clear All
            </button>
          </div>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Predefined Sets:</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {Object.keys(PREDEFINED_SETS).map(setName => (
              <button
                key={setName}
                type="button"
                onClick={() => handlePredefinedSetSelect(setName)}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.85em',
                  background: '#2A9D8F',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {setName}
              </button>
            ))}
          </div>
          <small className="help-text" style={{ display: 'block', marginTop: '8px' }}>
            Click a predefined set to automatically select all countries in that region/continent.
          </small>
        </div>

        <div style={{
          maxHeight: '400px',
          overflowY: 'auto',
          border: '1px solid #2A9D8F',
          borderRadius: '4px',
          padding: '10px',
          background: '#264653'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {ALL_COUNTRIES.map(country => (
              <label
                key={country}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  background: blacklistedCountries.includes(country) ? '#2A9D8F33' : 'transparent'
                }}
              >
                <input
                  type="checkbox"
                  checked={blacklistedCountries.includes(country)}
                  onChange={() => handleCountryToggle(country)}
                  style={{ cursor: 'pointer' }}
                />
                <span>{country}</span>
              </label>
            ))}
          </div>
        </div>
        <small className="help-text" style={{ display: 'block', marginTop: '8px' }}>
          Selected countries: {blacklistedCountries.length}. Accounts from these countries will be removed when "Remove blacklisted Countries" is enabled.
        </small>
      </div>

      <div className="button-container">
        <button id="save" onClick={saveSettings}>Save Settings</button>
        <button id="reset" onClick={resetSettings}>Reset to Defaults</button>
      </div>

      {statusMessage && (
        <div id="status" className={statusType}>
          {statusMessage}
        </div>
      )}
    </div>
  );
}
