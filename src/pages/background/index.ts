import { CleaningState, BackgroundMessage, MessageResponse, CleaningSettings } from '../../types/extension';

console.log("Background worker loaded");

let cleaningState: CleaningState = {
  isRunning: false,
  tabId: null,
  kept: 0,
  removed: 0,
  pageType: undefined
};

chrome.runtime.onMessage.addListener((request: BackgroundMessage, sender, sendResponse) => {
  switch (request.action) {
    case 'startCleaning':
      if (!cleaningState.isRunning) {
        chrome.storage.local.get(['usernamesToRemove'], (result) => {
          const usernamesToRemove = new Set(
            (result.usernamesToRemove || '')
              .split(/[\s,]+/)
              .map((u: string) => u.trim())
              .filter((u: string) => u)
          );

          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]?.id) {
              sendResponse({ error: 'No active tab found' });
              return;
            }

            // Validate page type matches URL
            const url = tabs[0].url || '';
            const isFollowersPage = url.match(/https?:\/\/(www\.)?(twitter|x)\.com\/[^/]+\/followers/);
            const isFollowingPage = url.match(/https?:\/\/(www\.)?(twitter|x)\.com\/[^/]+\/following/);
            
            if (request.pageType === 'followers' && !isFollowersPage) {
              sendResponse({ error: 'Please navigate to the followers page to clean followers' });
              return;
            }
            
            if (request.pageType === 'following' && !isFollowingPage) {
              sendResponse({ error: 'Please navigate to the following page to clean following' });
              return;
            }

            cleaningState = {
              isRunning: true,
              tabId: tabs[0].id,
              kept: 0,
              removed: 0,
              pageType: request.pageType
            };
            
            chrome.storage.local.get(['blacklistedCountries'], (countryResult) => {
              const blacklistedCountries = (countryResult.blacklistedCountries || []) as string[];
              
              const settings: CleaningSettings & { usernamesToRemove: string[] } = {
                maxFollowers: request.maxFollowers,
                minFollowing: request.minFollowing,
                maxPosts: request.maxPosts,
                skipUntilUsername: request.skipUntilUsername,
                usernameDigits: request.usernameDigits,
                minPostAgeDays: request.minPostAgeDays,
                bioMatchesText: request.bioMatchesText,
                isDryRun: request.isDryRun,
                removeBlacklistedCountries: request.removeBlacklistedCountries,
                blacklistedCountries: request.removeBlacklistedCountries ? blacklistedCountries : [],
                usernamesToRemove: Array.from(usernamesToRemove) as string[]
              };

              // Content script is already loaded via manifest, just send the message
              chrome.tabs.sendMessage(tabs[0].id as number, {
                action: 'start',
                pageType: request.pageType,
                ...settings
              }, (response: MessageResponse) => {
                if (chrome.runtime.lastError) {
                  console.error("Error sending message:", chrome.runtime.lastError);
                  cleaningState.isRunning = false;
                  const pageTypeName = request.pageType === 'followers' ? 'followers' : 'following';
                  sendResponse({ error: `Failed to communicate with content script. Make sure you are on the X.com ${pageTypeName} page.` });
                } else {
                  sendResponse({ success: true });
                }
              });
            });

          });
        });
        return true; // Async response
      } else {
        sendResponse({ error: 'Cleaning process is already running' });
        return false; // Synchronous response
      }

    case 'stopCleaning':
      if (cleaningState.isRunning && cleaningState.tabId) {
        chrome.tabs.sendMessage(cleaningState.tabId as number, { action: 'stopCleaning' });
        cleaningState.isRunning = false;
      }
      sendResponse({ success: true });
      return false; // Synchronous response

    case 'updateProgress':
      if (cleaningState.isRunning && sender.tab && sender.tab.id === cleaningState.tabId) {
        cleaningState.kept = request.kept;
        cleaningState.removed = request.removed;
        console.log(`[Background] Updated progress: kept=${cleaningState.kept}, removed=${cleaningState.removed}`);
      } else {
        console.log(`[Background] Ignoring updateProgress: isRunning=${cleaningState.isRunning}, tabId=${cleaningState.tabId}, sender.tab.id=${sender.tab?.id}`);
      }
      // No response needed for updateProgress
      return false;

    case 'cleaningComplete':
      if (cleaningState.isRunning && sender.tab && sender.tab.id === cleaningState.tabId) {
        cleaningState = {
          isRunning: false,
          tabId: null,
          kept: request.kept,
          removed: request.removed,
          pageType: cleaningState.pageType
        };
      }
      // No response needed for cleaningComplete
      return false;

    case 'cleaningError':
      console.error('Cleaning error:', request.error);
      cleaningState = {
        isRunning: false,
        tabId: null,
        kept: cleaningState.kept,
        removed: cleaningState.removed,
        pageType: cleaningState.pageType
      };
      // No response needed for cleaningError
      return false;

    case 'getCleaningState':
      console.log(`[Background] getCleaningState requested, returning:`, cleaningState);
      sendResponse(cleaningState);
      return false; // Synchronous response

    default:
      return false; // No response needed
  }
});
