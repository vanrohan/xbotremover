import React, { useState, useEffect } from 'react';
import { CleaningSettings, CleaningState, BackgroundMessage } from '../../types/extension';
import './popup.css';

export default function Popup() {
  const [cleaningState, setCleaningState] = useState<CleaningState>({
    isRunning: false,
    tabId: null,
    kept: 0,
    removed: 0
  });

  const [settings, setSettings] = useState<CleaningSettings>({
    maxFollowers: 50,
    minFollowing: 1000,
    maxPosts: 1,
    skipUntilUsername: null,
    usernameDigits: 7,
    minPostAgeDays: 180,
    bioMatchesText: null,
    isDryRun: false,
    removeBlacklistedCountries: false,
    blacklistedCountries: []
  });

  const [enabledSettings, setEnabledSettings] = useState({
    enableMaxFollowers: false,
    enableMinFollowing: false,
    enableMaxPosts: false,
    enableSkipUntilUsername: false,
    enableUsernameDigits: false,
    enableInactivityDays: false,
    enableBioMatches: false,
    enableDryRun: true,
    enableRemoveBlacklistedCountries: false
  });

  const [isValidPage, setIsValidPage] = useState(false);
  const [pageType, setPageType] = useState<'followers' | 'following' | null>(null);
  const [statusMessage, setStatusMessage] = useState('Please navigate to your X.com followers or following page.');

  useEffect(() => {
    // Immediately fetch current cleaning state when popup opens
    const fetchState = () => {
      chrome.runtime.sendMessage({ action: 'getCleaningState' }, (response: CleaningState) => {
        console.log('[Popup] Received cleaning state:', response);
        if (response) {
          setCleaningState(response);
        } else {
          console.warn('[Popup] No response received from getCleaningState');
        }
      });
    };

    fetchState();
    checkPageAndUpdateUI();
    loadBlacklistedCountries();

    // Set up periodic refresh of state while cleaning is running
    const intervalId = setInterval(() => {
      fetchState();
    }, 1000); // Refresh every second

    // Listen for messages from background script
    const messageListener = (request: any) => {
      if (request.action === 'updateProgress' || request.action === 'cleaningComplete') {
        fetchState();
        if (request.action === 'cleaningComplete') {
          setStatusMessage('Cleaning complete!');
        }
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    
    return () => {
      clearInterval(intervalId);
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const loadBlacklistedCountries = () => {
    chrome.storage.local.get(['blacklistedCountries'], (result) => {
      if (result.blacklistedCountries) {
        setSettings(prev => ({ ...prev, blacklistedCountries: result.blacklistedCountries }));
      }
    });
  };

  const checkPageAndUpdateUI = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || '';
      const isFollowersPage = url.match(/https?:\/\/(www\.)?(twitter|x)\.com\/[^/]+\/followers/);
      const isFollowingPage = url.match(/https?:\/\/(www\.)?(twitter|x)\.com\/[^/]+\/following/);

      const isValid = !!(isFollowersPage || isFollowingPage);
      setIsValidPage(isValid);

      if (isFollowersPage) {
        setPageType('followers');
        setStatusMessage('');
      } else if (isFollowingPage) {
        setPageType('following');
        setStatusMessage('');
      } else {
        setPageType(null);
        setStatusMessage('Please navigate to your X.com followers or following page.\nhttps://x.com/{your_username}/followers\nhttps://x.com/{your_username}/following');
      }

      chrome.runtime.sendMessage({ action: 'getCleaningState' }, (response: CleaningState) => {
        if (response) {
          setCleaningState(response);
        }
      });
    });
  };

  const validateForm = () => {
    return enabledSettings.enableMaxFollowers || 
    enabledSettings.enableMinFollowing || 
    enabledSettings.enableMaxPosts || 
    enabledSettings.enableUsernameDigits || 
    enabledSettings.enableInactivityDays || 
    enabledSettings.enableBioMatches ||
    enabledSettings.enableRemoveBlacklistedCountries;
  };

  const handleStart = () => {
    if (!pageType) {
      setStatusMessage('Invalid page type detected');
      return;
    }

    const message: BackgroundMessage = {
      action: 'startCleaning',
      pageType: pageType,
      maxFollowers: enabledSettings.enableMaxFollowers ? settings.maxFollowers : null,
      minFollowing: enabledSettings.enableMinFollowing ? settings.minFollowing : null,
      maxPosts: enabledSettings.enableMaxPosts ? settings.maxPosts : null,
      skipUntilUsername: enabledSettings.enableSkipUntilUsername ? settings.skipUntilUsername : null,
      usernameDigits: enabledSettings.enableUsernameDigits ? settings.usernameDigits : null,
      minPostAgeDays: enabledSettings.enableInactivityDays ? settings.minPostAgeDays : null,
      bioMatchesText: enabledSettings.enableBioMatches ? settings.bioMatchesText : null,
      isDryRun: enabledSettings.enableDryRun,
      removeBlacklistedCountries: enabledSettings.enableRemoveBlacklistedCountries,
      blacklistedCountries: enabledSettings.enableRemoveBlacklistedCountries ? settings.blacklistedCountries : []
    };

    chrome.runtime.sendMessage(message, (response) => {
      if (response && response.error) {
        setStatusMessage(response.error);
      } else if (response && response.success) {
        setCleaningState({
          isRunning: true,
          tabId: null,
          kept: 0,
          removed: 0
        });
      }
    });
  };

  const handleStop = () => {
    chrome.runtime.sendMessage({ action: 'stopCleaning' }, () => {
      checkPageAndUpdateUI();
    });
  };

  const handleSettingsClick = () => {
    chrome.runtime.openOptionsPage();
  };

  const handleSettingChange = (key: keyof CleaningSettings, value: number | boolean | string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleEnabledChange = (key: keyof typeof enabledSettings, value: boolean) => {
    setEnabledSettings(prev => ({ ...prev, [key]: value }));
  };

  const isFormValid = validateForm();
  const canStart = isValidPage && isFormValid && !cleaningState.isRunning;

  return (
    <div id="popup-content" className="popup-container">
      <div className="header">
        <img src="/images/icon128.png" alt="Bot Remover" />
        <div className="header-text">
          <h1>⚔️ Bot Remover</h1>
          <h2>The battle has begun</h2>
        </div>
      </div>

      {isValidPage && (
        <div className="header-with-settings">
          <h4>{pageType === 'followers' ? 'Remove followers' : 'Unfollow accounts'} matching below:</h4>
          <div id="settings-icon" title="Technical Settings" onClick={handleSettingsClick}>⚙️</div>
        </div>
      )}

      {isValidPage && !cleaningState.isRunning && (
        <div id="input-container">
          <div className="input-row">
            <div className="input-group">
              <div className="checkbox-input">
                <input
                  type="checkbox"
                  id="enable-min-following"
                  checked={enabledSettings.enableMinFollowing}
                  onChange={(e) => handleEnabledChange('enableMinFollowing', e.target.checked)}
                />
                <label htmlFor="min-following">Following &gt; than:</label>
              </div>
              {enabledSettings.enableMinFollowing && (
                <input
                  type="number"
                  id="min-following"
                  value={settings.minFollowing || ''}
                  onChange={(e) => handleSettingChange('minFollowing', parseInt(e.target.value))}
                  min="0"
                  step="100"
                />
              )}
            </div>

            <div className="input-group">
              <div className="checkbox-input">
                <input
                  type="checkbox"
                  id="enable-max-followers"
                  checked={enabledSettings.enableMaxFollowers}
                  onChange={(e) => handleEnabledChange('enableMaxFollowers', e.target.checked)}
                />
                <label htmlFor="max-followers">Followers &lt; than:</label>
              </div>
              {enabledSettings.enableMaxFollowers && (
                <input
                  type="number"
                  id="max-followers"
                  value={settings.maxFollowers || ''}
                  onChange={(e) => handleSettingChange('maxFollowers', parseInt(e.target.value))}
                  min="0"
                  step="1"
                />
              )}
            </div>
          </div>

          <div className="input-row">
            <div className="input-group">
              <div className="checkbox-input">
                <input
                  type="checkbox"
                  id="enable-max-posts"
                  checked={enabledSettings.enableMaxPosts}
                  onChange={(e) => handleEnabledChange('enableMaxPosts', e.target.checked)}
                />
                <label htmlFor="max-posts">Post count &lt;= than:</label>
              </div>
              {enabledSettings.enableMaxPosts && (
                <input
                  type="number"
                  id="max-posts"
                  value={settings.maxPosts || 1}
                  onChange={(e) => handleSettingChange('maxPosts', parseInt(e.target.value))}
                  min="0"
                  step="1"
                />
              )}
            </div>

            <div className="input-group">
              <div className="checkbox-input">
                <input
                  type="checkbox"
                  id="enable-username-digits"
                  checked={enabledSettings.enableUsernameDigits}
                  onChange={(e) => handleEnabledChange('enableUsernameDigits', e.target.checked)}
                />
                <label htmlFor="username-digits"># digits in name &gt;=</label>
              </div>
              {enabledSettings.enableUsernameDigits && (
                <input
                  type="number"
                  id="username-digits"
                  value={settings.usernameDigits || ''}
                  onChange={(e) => handleSettingChange('usernameDigits', parseInt(e.target.value))}
                  min="1"
                  step="1"
                />
              )}
            </div>
          </div>

          <div className="input-row">
            <div className="input-group">
              <div className="checkbox-input">
                <input
                  type="checkbox"
                  id="enable-bio-matches"
                  checked={enabledSettings.enableBioMatches}
                  onChange={(e) => handleEnabledChange('enableBioMatches', e.target.checked)}
                />
                <label htmlFor="bio-matches">Bio matches text:</label>
              </div>
              {enabledSettings.enableBioMatches && (
                <input
                  type="text"
                  id="bio-matches"
                  value={settings.bioMatchesText || ''}
                  onChange={(e) => handleSettingChange('bioMatchesText', e.target.value)}
                  placeholder="Enter text to match in bio"
                />
              )}
            </div>
          </div>

          <div className="input-row">
            <div className="input-group">
              <div className="checkbox-input">
                <input
                  type="checkbox"
                  id="enable-remove-blacklisted-countries"
                  checked={enabledSettings.enableRemoveBlacklistedCountries}
                  onChange={(e) => handleEnabledChange('enableRemoveBlacklistedCountries', e.target.checked)}
                />
                <label htmlFor="enable-remove-blacklisted-countries">Remove blacklisted Countries</label>
              </div>
            </div>
          </div>

          <div className="input-row">
            <div className="input-group">
              <div className="checkbox-input">
                <input
                  type="checkbox"
                  id="enable-inactivity-days"
                  checked={enabledSettings.enableInactivityDays}
                  onChange={(e) => handleEnabledChange('enableInactivityDays', e.target.checked)}
                />
                <label htmlFor="inactivity-days">Inactive for days &gt;=</label>
              </div>
              {enabledSettings.enableInactivityDays && (
                <input
                  type="number"
                  id="inactivity-days"
                  value={settings.minPostAgeDays || ''}
                  onChange={(e) => handleSettingChange('minPostAgeDays', parseInt(e.target.value))}
                  min="1"
                  step="1"
                />
              )}
            </div>
            <div className="input-group">
              <div className="checkbox-input">
                <input
                  type="checkbox"
                  id="enable-skip-until-username"
                  checked={enabledSettings.enableSkipUntilUsername}
                  onChange={(e) => handleEnabledChange('enableSkipUntilUsername', e.target.checked)}
                />
                <label htmlFor="skip-until-username">Skip until user:</label>
              </div>
              {enabledSettings.enableSkipUntilUsername && (
                <input
                  type="text"
                  id="skip-until-username"
                  value={settings.skipUntilUsername || ''}
                  onChange={(e) => {
                    let value = e.target.value;
                    // Remove @ sign if user types it
                    if (value.startsWith('@')) {
                      value = value.slice(1);
                    }
                    handleSettingChange('skipUntilUsername', value)
                  }}
                  placeholder="Enter target username"
                />
              )}
            </div>
          </div>

          <div className="warning-section">
            <div id="warning-text">
              {pageType === 'followers' ? 'Removing followers' : 'Unfollowing accounts'} cannot be undone.
            </div>
            {!isFormValid && (
              <div id="validation-warning">
                Please enable at least one rule
              </div>
            )}
          </div>

          <div className="controls">
            <div className="dry-run-control">
              <input
                type="checkbox"
                id="enable-dry-run"
                checked={enabledSettings.enableDryRun}
                onChange={(e) => handleEnabledChange('enableDryRun', e.target.checked)}
              />
              <label
                htmlFor="enable-dry-run"
                style={{ minWidth: '85px', display: 'inline-block' }}
              >
                Test Run
              </label>
            </div>
            <button
              id="start-btn"
              onClick={handleStart}
              disabled={!canStart}
            >
              {pageType === 'followers' ? 'Start Cleaning' : 'Start'}
            </button>
          </div>
        </div>
      )}

      {isValidPage && cleaningState.isRunning && (
        <>
          <div id="keep-open-text">
            Do not use this tab for anything else. You may switch to another tab and come back later.
            To force stop the extension, refresh the page.
          </div>
          <button id="stop-btn" onClick={handleStop}>
            Stop
          </button>
        </>
      )}

      {statusMessage && (
        <p id="status-message" style={{ fontSize: '14px' }}>{statusMessage}</p>
      )}

      {isValidPage && cleaningState.isRunning && (
        <div id="metrics-container">
          <div className="metric">
            <span className="metric-label">Processed:</span>
            <span className="metric-value">{cleaningState.kept + cleaningState.removed}</span>
          </div>
          <div className="metric-row">
            <div className="metric">
              <span className="metric-label">Kept</span>
              <span className="metric-value">{cleaningState.kept}</span>
            </div>
            <div className="metric">
              <span className="metric-label">{pageType === 'followers' ? 'Removed' : 'Unfollowed'}</span>
              <span className="metric-value">{cleaningState.removed}</span>
            </div>
          </div>
        </div>
      )}

      <div className="footer">
        <div>
          <a href="https://x.com/vanrohan776" target="_blank" id="follow-link">
            Follow me on 𝕏
          </a>
        </div>
        <div>
          <a
            href="https://buy.stripe.com/dR601YaAK5LugkofZ2"
            target="_blank"
            className="coffee-link"
          >
            ☕ Buy me a coffee
          </a>
        </div>
      </div>
    </div>
  );
}
