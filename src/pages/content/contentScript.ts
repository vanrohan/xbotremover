import { ContentMessage, FollowerData, FollowerStats, ProfileData, TechnicalSettings } from '../../types/extension';

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));



class FollowerCleaner {
  private maxFollowers: number | null = null;
  private minFollowing: number | null = null;
  private maxPosts: number | null = null;
  private maxUsernameDigits: number | null = null;
  private minPostAgeDays: number | null = null;
  private bioMatchesText: string | null = null;
  private isDryRun: boolean = false;
  private removeBlacklistedCountries: boolean = false;
  private blacklistedCountries: Set<string> = new Set();

  public keptCount: number = 0;
  public removedCount: number = 0;
  private removedProfiles: string[] = [];
  public stopCleaning: boolean = false;
  private skipUntilUsername: string | null = null;
  private usernamesToRemove: Set<string> = new Set();

  private settings: TechnicalSettings = {
    scrollDelay: 250,
    actionDelay: 450,
    hoverDelay: 350,
    profileLoadDelay: 2000,
    maxFollowerAttempts: 3,
    maxHoverAttempts: 5,
    maxScrollAttempts: 5
  };

  constructor() {
    // Load settings at initialization
    chrome.storage.sync.get(this.settings, (items) => {
      this.settings = items as TechnicalSettings;
    });
  }

  private async scrollToTop(): Promise<void> {
    window.scrollTo(0, 0);
    await delay(this.settings.scrollDelay);
  }

  private async scrollDown(): Promise<void> {
    window.scrollBy(0, window.innerHeight / 2);
    await delay(this.settings.scrollDelay);
  }

  private async findNextFollower(lastProcessedUsername: string | null): Promise<FollowerData | null> {
    let attempts = 0;
    const maxAttempts = this.settings.maxFollowerAttempts;

    while (attempts < maxAttempts) {
      const followerElements = document.querySelectorAll('[data-testid="cellInnerDiv"]');
      let foundLast = !lastProcessedUsername;

      for (const element of followerElements) {
        const linkElement = element.querySelector('a[href^="/"][role="link"]') as HTMLAnchorElement;
        if (!linkElement) continue;

        const username = linkElement.getAttribute('href')?.slice(1);
        if (!username) continue;

        if (foundLast) {
          const rect = element.getBoundingClientRect();
          if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
            return { element, username };
          }
        }

        if (username === lastProcessedUsername) {
          foundLast = true;
        }
      }

      if (attempts < maxAttempts - 1) {
        console.log(`No follower found, attempt ${attempts + 1}/${maxAttempts}. Scrolling and retrying...`);
        await delay(this.settings.scrollDelay);
        await this.scrollDown();
        await delay(this.settings.hoverDelay);
      }

      attempts++;
    }

    console.log("No follower found after multiple attempts");
    return null;
  }

  private parseCount(text: string): number {
    if (!text) return 0;

    const cleanText = text.replace(/,/g, '').toUpperCase();
    const match = cleanText.match(/^([\d.]+)\s*([KMB])?$/);

    if (!match) {
      console.log("Could not parse count format:", text);
      return 0;
    }

    const [, numStr, suffix] = match;
    const num = parseFloat(numStr);

    switch (suffix) {
      case 'K': return Math.round(num * 1000);
      case 'M': return Math.round(num * 1000000);
      case 'B': return Math.round(num * 1000000000);
      default: return Math.round(num);
    }
  }

  private async hoverAndGetStats(followerElement: Element): Promise<FollowerStats | null> {
    const linkElement = followerElement.querySelector('a[href^="/"]') as HTMLAnchorElement;
    if (!linkElement) {
      console.log("Link element for stats hovering not found for a follower");
      return null;
    }

    const username = linkElement.getAttribute('href')?.slice(1);
    if (!username) return null;

    // Simulate hover interaction
    const events = ['mouseover', 'mouseenter'];
    for (const eventType of events) {
      const event = new MouseEvent(eventType, {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: linkElement.getBoundingClientRect().left + 10,
        clientY: linkElement.getBoundingClientRect().top + 10
      });
      linkElement.dispatchEvent(event);
    }

    // Wait for mini profile to load
    let miniProfile: Element | null = null;
    let attempts = 0;
    const maxAttempts = this.settings.maxHoverAttempts;

    while (!miniProfile && attempts < maxAttempts) {
      await delay(this.settings.hoverDelay);
      miniProfile = document.querySelector('[data-testid="HoverCard"], [role="tooltip"], [data-testid="profile-hover-card"]');
      attempts++;
    }

    if (!miniProfile) {
      console.log(`Mini profile not found for: ${username} after ${attempts} attempts`);
      return null;
    }

    // Extract follower and following counts
    const followingElement = miniProfile.querySelector('a[href$="/following"] span span, a[href*="/following"] span span') as HTMLElement;
    const followersElement = miniProfile.querySelector('a[href$="/verified_followers"] span span, a[href$="/followers"] span span, a[href*="/followers"] span span') as HTMLElement;

    const following = followingElement ? this.parseCount(followingElement.textContent || '') : 0;
    const followers = followersElement ? this.parseCount(followersElement.textContent || '') : 0;

    // Extract bio text
    let bio = '';
    if (this.bioMatchesText !== null) {
      // Look for bio text in the hover card - it's typically in a div between the name/username and the following/followers stats

      const bioElements = miniProfile.querySelectorAll('div[dir="auto"] span');

      for (const element of bioElements) {
        const text = element.textContent?.trim() || '';
        // Skip elements that contain following/followers stats or are too short
        if (text &&
          !text.match(/^\d+[\s,]*Following$/i) &&
          !text.match(/^\d+[\s,]*Followers$/i) &&
          !text.match(/^@\w+$/) &&
          text.length > 2) {
          bio = text;
          break;
        }
      }
    }

    // Clean up by simulating mouse leave
    const leaveEvents = ['mouseout', 'mouseleave'];
    for (const eventType of leaveEvents) {
      const event = new MouseEvent(eventType, {
        view: window,
        bubbles: true,
        cancelable: true
      });
      linkElement.dispatchEvent(event);
    }

    // Wait for mini profile to unload
    let unloadAttempts = 0;
    const maxUnloadAttempts = 5;
    while (document.querySelector('[data-testid="HoverCard"], [role="tooltip"], [data-testid="profile-hover-card"]') && unloadAttempts < maxUnloadAttempts) {
      await delay(this.settings.hoverDelay);
      unloadAttempts++;
    }

    console.log(`Stats retrieved for ${username}: followers=${followers}, following=${following}${bio ? ', bio=' + bio.substring(0, 50) + '...' : ''}`);
    return { username, followers, following, bio };
  }

  private async navigateToProfile(username: string): Promise<boolean> {
    const profileLink = document.querySelector(`a[href="/${username}"]`) as HTMLAnchorElement;
    if (profileLink) {
      profileLink.click();
      await delay(this.settings.profileLoadDelay);
      return true;
    }
    console.error(`Couldn't find profile link for ${username}`);
    return false;
  }

  private async navigateToAboutPage(username: string): Promise<boolean> {
    // Step 1: Always navigate to the user's profile page first
    const currentUrl = window.location.href;
    const isOnProfilePage = currentUrl.includes(`/${username}`) && 
                            !currentUrl.includes('/followers') && 
                            !currentUrl.includes('/following') && 
                            !currentUrl.includes('/about');
    
    if (!isOnProfilePage) {
      console.log(`Navigating to profile page for ${username}...`);
      const profileLink = document.querySelector(`a[href="/${username}"]`) as HTMLAnchorElement;
      if (profileLink) {
        profileLink.click();
        await delay(this.settings.profileLoadDelay);
      } else {
        // Fallback to direct navigation
        window.location.href = `https://x.com/${username}`;
        await delay(this.settings.profileLoadDelay);
      }
      
      // Wait for profile page to fully load - verify we're on the profile page
      let profileLoadAttempts = 0;
      const maxProfileLoadAttempts = 10;
      while (profileLoadAttempts < maxProfileLoadAttempts) {
        await delay(500);
        const newUrl = window.location.href;
        if (newUrl.includes(`/${username}`) && !newUrl.includes('/followers') && !newUrl.includes('/following') && !newUrl.includes('/about')) {
          console.log(`Successfully navigated to profile page for ${username}`);
          break;
        }
        profileLoadAttempts++;
      }
    } else {
      console.log(`Already on profile page for ${username}`);
    }

    // Step 2: Now navigate to the about page via the menu
    console.log(`Opening menu to navigate to about page for ${username}...`);
    
    // Find and click the menu button (three dots)
    let menuButton: HTMLElement | null = null;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (!menuButton && attempts < maxAttempts) {
      // Look for the menu button - it's typically a button with the three dots SVG
      const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
      menuButton = buttons.find(btn => {
        const svg = btn.querySelector('svg');
        if (svg) {
          const path = svg.querySelector('path');
          if (path) {
            const d = path.getAttribute('d');
            // The three dots menu has a specific path pattern: M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm7 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z
            return d && (d.includes('M3 12c0-1.1') || d.includes('M3 12') && d.includes('M19 12'));
          }
        }
        return false;
      }) as HTMLElement | null;
      
      if (!menuButton) {
        await delay(500);
        attempts++;
      }
    }

    if (!menuButton) {
      console.error(`Menu button not found for ${username}`);
      return false;
    }

    // Click the menu button
    menuButton.click();
    await delay(this.settings.actionDelay);

    // Find and click the "About this account" menu item
    const menuItems = Array.from(document.querySelectorAll('[role="menuitem"]'));
    const aboutMenuItem = menuItems.find(item => {
      const text = item.textContent?.trim();
      return text === 'About this account';
    }) as HTMLElement | null;

    if (!aboutMenuItem) {
      console.error(`About this account menu item not found for ${username}`);
      return false;
    }

    aboutMenuItem.click();
    await delay(this.settings.profileLoadDelay);
    
    // Wait for about page to load and verify we're on it
    let aboutPageLoadAttempts = 0;
    const maxAboutPageLoadAttempts = 10;
    while (aboutPageLoadAttempts < maxAboutPageLoadAttempts) {
      await delay(500);
      const currentUrl = window.location.href;
      if (currentUrl.includes('/about')) {
        console.log(`Successfully navigated to about page for ${username}`);
        break;
      }
      aboutPageLoadAttempts++;
    }
    
    // Add 3 second wait to avoid rate limiting on the about page API endpoint
    console.log(`[Rate Limit] Waiting 6 seconds after opening about page to avoid rate limiting...`);
    await delay(7000);
    
    return true;
  }

  public async getAccountCountry(): Promise<string | null> {
    // Wait a bit for page to load
    await delay(500);
    
    console.log(`[Country Extraction] Starting country extraction`);
    
    // Method 1: Look for the "Account based in" label and find the country in the next div
    const accountBasedInLabels = Array.from(document.querySelectorAll('*')).filter(el => {
      const text = el.textContent?.trim();
      return text === 'Account based in';
    });
       
    if (accountBasedInLabels.length > 0) {
      const labelElement = accountBasedInLabels[0];
      
      // Find the parent container (role="tab" element)
      let tabElement = labelElement.closest('[role="tab"]');
      if (!tabElement) {
        // Try finding parent with data-testid="pivot"
        tabElement = labelElement.closest('[data-testid="pivot"]');
      }
      
      
      if (tabElement) {
        // Look for the div with the country value - it's typically the next div with color rgb(113, 118, 123)
        const allDivs = Array.from(tabElement.querySelectorAll('div'));
        
        const accountBasedInIndex = allDivs.findIndex(div => {
          return div.textContent?.trim() === 'Account based in';
        });
        
        
        if (accountBasedInIndex >= 0) {
          // The country is usually in the next div or a sibling
          for (let i = accountBasedInIndex + 1; i < Math.min(accountBasedInIndex + 10, allDivs.length); i++) {
            const div = allDivs[i];
            const text = div.textContent?.trim();
            
            // Skip empty divs and divs that still contain "Account based in"
            if (text && text !== 'Account based in' && text.length > 0 && text.length < 100) {
              // Check if this looks like a country name (not a date, not a link, etc.)
              if (!text.match(/^\d+/) && !text.includes('@') && !text.includes('http') && !text.includes('Since') && !text.includes('Date joined')) {
                console.log(`[Country Extraction] Found country: ${text}`);
                return text;
              }
            }
          }
        }
      }
    }
    
    console.warn(`[Country Extraction] Could not find country - assuming not available`);
    return null;
  }

  private async navigateBack(): Promise<void> {
    window.history.back();
    await delay(this.settings.hoverDelay);
  }

  private async navigateBackFromAboutPage(): Promise<void> {
    console.log(`[Navigation] Navigating back from about page (2x back)`);
    // Navigate back twice: about -> profile -> followers
    window.history.back();
    await delay(1000);
    
    // Verify we're back on the profile page or followers page
    let attempts = 0;
    const maxAttempts = 10;
    while (attempts < maxAttempts) {
      const currentUrl = window.location.href;
      if (!currentUrl.includes('/about')) {
        console.log(`[Navigation] Successfully navigated back from about page. Current URL: ${currentUrl}`);
        break;
      }
      await delay(500);
      attempts++;
    }
    
    // Second back navigation
    window.history.back();
    await delay(1000);
    
    // Verify we're back on the followers page
    attempts = 0;
    while (attempts < maxAttempts) {
      const currentUrl = window.location.href;
      if (currentUrl.includes('/followers')) {
        console.log(`[Navigation] Successfully navigated back to followers page. Current URL: ${currentUrl}`);
        break;
      }
      await delay(500);
      attempts++;
    }
  }

  private async collectProfileData(): Promise<ProfileData | null> {
    const followersElement = document.querySelector('a[href$="/verified_followers"] span span') as HTMLElement;
    const followingElement = document.querySelector('a[href$="/following"] span span') as HTMLElement;
    const headerBar = document.querySelector('button[data-testid="app-bar-back"]')?.parentElement?.parentElement;

    if (!headerBar) {
      console.log("Header bar not found");
      return null;
    }

    const findLeafElements = (element: Element): Element[] => {
      if (element.children.length === 0) {
        return [element];
      }
      let leafElements: Element[] = [];
      for (let child of element.children) {
        leafElements = leafElements.concat(findLeafElements(child));
      }
      return leafElements;
    };

    // Try to find posts count
    let postsElement = findLeafElements(headerBar).find(el => /^[\d,.]+ posts$/.test(el.textContent?.trim() || ''));

    if (!postsElement) {
      postsElement = findLeafElements(headerBar).find(el => /^[\d,.]+K?\s*posts$/i.test(el.textContent?.trim() || ''));
    }

    if (!postsElement) {
      postsElement = findLeafElements(headerBar).find(el => /^[\d,.]+\s*post$/i.test(el.textContent?.trim() || ''));
    }

    const followers = this.parseCount(followersElement?.textContent || '');
    const following = this.parseCount(followingElement?.textContent || '');
    const posts = postsElement ? this.parseCount((postsElement.textContent || '').split(' ')[0]) : null;
    const ratio = following > 0 ? (followers / following).toFixed(2) : 'N/A';

    let latestPostAgeDays: number | null = null;
    if (this.minPostAgeDays !== null) {
      const lastTweetDate = await this.getLastTweetDate();
      if (lastTweetDate) {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - lastTweetDate.getTime());
        latestPostAgeDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        console.log(`Latest post age days: ${latestPostAgeDays}`);
        if (latestPostAgeDays > this.minPostAgeDays) {
          console.log(`checking replies to see if there are more recent posts`);
          const lastReplyDate = await this.getLastReplyDate();
          if (lastReplyDate) {
            const diffTime = Math.abs(now.getTime() - lastReplyDate.getTime());
            latestPostAgeDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            console.log(`Latest reply age days: ${latestPostAgeDays}`);
          }
        }
      }
    }

    return { username: '', followers, following, posts, ratio, latestPostAgeDays: latestPostAgeDays || null };
  }

  private async getLastTweetDate(): Promise<Date | null> {
    let attempts = 0;
    const maxAttempts = 5;
    const delayMs = 1000;

    while (attempts < maxAttempts) {
      const timeElements = document.querySelectorAll([
        'article time[datetime]',
        'div[data-testid="cellInnerDiv"] time[datetime]',
        'article a[href*="/status/"] time'
      ].join(',')) as NodeListOf<HTMLTimeElement>;

      if (timeElements && timeElements.length > 0) {
        const sortedTimeElements = Array.from(timeElements).sort((a, b) => {
          const dateA = new Date(a.getAttribute('datetime') || '');
          const dateB = new Date(b.getAttribute('datetime') || '');
          return dateB.getTime() - dateA.getTime();
        });

        const timeElement = sortedTimeElements[0];
        const dateStr = timeElement.getAttribute('datetime');
        if (dateStr) {
          return new Date(dateStr);
        }
      }

      await delay(delayMs);
      attempts++;
    }

    console.warn('Followers: Failed to find tweet dates after multiple attempts - using 10 years old date');
    return new Date('2015-01-01');
  }

  private async getLastReplyDate(): Promise<Date | null> {
    // navigate to the replies page
    const repliesLink = document.querySelector('a[href$="/with_replies"]') as HTMLAnchorElement;
    if (repliesLink) {
      repliesLink.click();
      await delay(3500);
    }

    // get the last reply date
    const replyElements = document.querySelectorAll('article[data-testid="tweet"] time[datetime]') as NodeListOf<HTMLTimeElement>;
    if (replyElements && replyElements.length > 0) {
      const sortedReplyElements = Array.from(replyElements).sort((a, b) => {
        const dateA = new Date(a.getAttribute('datetime') || '');
        const dateB = new Date(b.getAttribute('datetime') || '');
        return dateB.getTime() - dateA.getTime();
      });

      window.history.back();
      await delay(2000);

      return sortedReplyElements[0].getAttribute('datetime') ? new Date(sortedReplyElements[0].getAttribute('datetime')!) : null;
    }
    window.history.back();
    await delay(2000);
    console.warn('Followers: Failed to find reply dates after multiple attempts - using 10 years old date');
    return new Date('2015-01-01');
  }

  public async removeFollower(username: string): Promise<boolean> {
    console.log(`Attempting to remove follower: ${username}`);

    const followerElement = await this.findFollowerElement(username);
    if (!followerElement) {
      console.log(`Follower element not found for: ${username}`);
      return false;
    }

    const moreButton = followerElement.querySelector('button[aria-label="More"]') as HTMLButtonElement;
    if (!moreButton) {
      console.log(`More button not found for follower: ${username}`);
      return false;
    }

    moreButton.click();
    await delay(this.settings.actionDelay);

    const removeButton = Array.from(document.querySelectorAll('span'))
      .find(el => el.textContent === 'Remove this follower') as HTMLElement;

    if (removeButton) {
      removeButton.click();
      await delay(this.settings.actionDelay);

      const confirmButton = Array.from(document.querySelectorAll('div'))
        .find(el => el.textContent === 'Remove') as HTMLElement;

      if (confirmButton) {
        confirmButton.click();
        await delay(this.settings.actionDelay);
        return true;
      } else {
        console.log(`Confirmation button not found for: ${username}`);
      }
    } else {
      console.log(`Remove button not found for: ${username}`);
    }
    return false;
  }

  public async findFollowerElement(username: string): Promise<Element | null> {
    const followerElements = document.querySelectorAll('[data-testid="cellInnerDiv"]');
    for (const element of followerElements) {
      const linkElement = element.querySelector(`a[href="/${username}"]`);
      if (linkElement) {
        return element;
      }
    }
    return null;
  }

  private async processFollower(followerData: FollowerData): Promise<void> {
    const { element, username } = followerData;
    console.log(`Processing follower: ${username}`);

    // Check if username is in the removal list
    if (this.usernamesToRemove.has(username)) {
      console.log(`User ${username} will be removed as it's in the forced removal list`);
      try {
        if (!this.isDryRun) {
          const removed = await this.removeFollower(username);
          if (removed) {
            this.removedCount++;
            this.removedProfiles.push(username);
          } else {
            this.keptCount++;
          }
        } else {
          console.log(`[DRY RUN] Would remove ${username} (in forced removal list)`);
          this.removedCount++;
          this.removedProfiles.push(username);
        }
      } catch (error) {
        console.error(`Error removing follower ${username}:`, error);
      }
      return;
    }

    // Check country if enabled
    if (this.removeBlacklistedCountries && this.blacklistedCountries.size > 0) {
      // Check if stop was requested
      if (this.stopCleaning) {
        console.log(`[Country Check] Stop requested, skipping country check for ${username}`);
        return;
      }
      
      console.log(`[Country Check] Checking country for ${username}...`);
      
      const navigated = await this.navigateToAboutPage(username);
      if (!navigated) {
        console.log(`[Country Check] Failed to navigate to about page for ${username}, skipping country check`);
        // Continue processing without country check
      } else {
        // Check if stop was requested during navigation
        if (this.stopCleaning) {
          console.log(`[Country Check] Stop requested, aborting country check for ${username}`);
          await this.navigateBackFromAboutPage();
          return;
        }
        
        console.log(`[Country Check] Successfully navigated to about page for ${username}`);
        
        // Extract country from about page
        const country = await this.getAccountCountry();
        console.log(`[Country Check] Extracted country for ${username}: ${country || 'null'}`);
        
        // Check if stop was requested during extraction
        if (this.stopCleaning) {
          console.log(`[Country Check] Stop requested, aborting country check for ${username}`);
          await this.navigateBackFromAboutPage();
          return;
        }
        
        // Navigate back to followers page
        await this.navigateBackFromAboutPage();
        console.log(`[Country Check] Navigated back to followers page`);
        
        // Check if country is blacklisted (normalize for case-insensitive comparison)
        const normalizedCountry = country ? country.trim() : null;
        const isBlacklisted = normalizedCountry && Array.from(this.blacklistedCountries).some(
          blacklisted => blacklisted.trim().toLowerCase() === normalizedCountry.toLowerCase()
        );
        
        if (isBlacklisted) {
          console.log(`[Country Check] ${username} is from blacklisted country: ${normalizedCountry}. Removing...`);
          try {
            if (!this.isDryRun) {
              const removed = await this.removeFollower(username);
              if (removed) {
                this.removedCount++;
                this.removedProfiles.push(username);
              } else {
                this.keptCount++;
              }
            } else {
              console.log(`[DRY RUN] Would remove ${username} (blacklisted country: ${normalizedCountry})`);
              this.removedCount++;
              this.removedProfiles.push(username);
            }
          } catch (error) {
            console.error(`[Country Check] Error removing follower ${username}:`, error);
            this.keptCount++;
          }
          return;
        } else {
          console.log(`[Country Check] ${username} is not from a blacklisted country (country: ${country || 'unknown'}). Keeping...`);
          // Continue with normal processing
        }
      }
    }



    // Check for consecutive digits in username if enabled
    if (this.maxUsernameDigits !== null) {
      const consecutiveDigits = username.match(/\d+/g);
      if (consecutiveDigits && consecutiveDigits.some(digits => digits.length >= this.maxUsernameDigits!)) {
        console.log(`User ${username} would be removed due to ${this.maxUsernameDigits} or more consecutive digits in username`);
        try {
          if (!this.isDryRun) {
            const removed = await this.removeFollower(username);
            if (removed) {
              this.removedCount++;
              this.removedProfiles.push(username);
            } else {
              this.keptCount++;
            }
          } else {
            console.log(`[DRY RUN] Would remove ${username}`);
            this.removedCount++;
            this.removedProfiles.push(username);
          }
        } catch (error) {
          console.error(`Error processing follower ${username}:`, error);
        }
        return;
      }
    }

    // Get stats and handle potential null response
    const stats = await this.hoverAndGetStats(element);
    if (!stats) {
      console.log(`Could not get stats for ${username}, skipping...`);
      this.keptCount++;
      return;
    }

    const { followers, following, bio } = stats;

    // Check if bio matches criteria (if enabled)
    if (this.bioMatchesText !== null && bio) {
      const bioLower = bio.toLowerCase();
      const searchTextLower = this.bioMatchesText.toLowerCase();
      if (!bioLower.includes(searchTextLower)) {
        console.log(`Skipping profile ${username} as bio does not contain "${this.bioMatchesText}"`);
        this.keptCount++;
        return;
      }
    }

    // Check initial criteria (if enabled) - this speeds up the process by skipping ineligible profiles early
    if (this.maxFollowers === null) {
      if (this.minFollowing !== null && following < (this.minFollowing || 0)) {
        console.log(`Skipping profile ${username} as it doesn't match the criteria`);
        this.keptCount++;
        return;
      }
    } else if (this.minFollowing === null) {
      if (this.maxFollowers !== null && followers > this.maxFollowers) {
        console.log(`Skipping profile ${username} as it doesn't match the criteria`);
        this.keptCount++;
        return;
      }
    } else if (this.maxFollowers !== null && followers > this.maxFollowers || this.minFollowing !== null && following < this.minFollowing) {
      console.log(`Skipping profile ${username} as it doesn't match the criteria`);
      this.keptCount++;
      return;
    }

    let profileData: ProfileData | null = null;
    if (this.maxPosts !== null || this.minPostAgeDays !== null) {
      console.log(`Navigating to profile ${username} as it matches the criteria to check Post Count`);

      const navigated = await this.navigateToProfile(username);
      if (!navigated) {
        console.log(`Failed to navigate to profile for ${username}`);
        return;
      }

      profileData = await this.collectProfileData();

      if (!profileData) {
        console.log(`Failed to collect profile data for ${username}`);
        await this.navigateBack();
        return;
      }
      profileData.bio = bio;

      console.log(`${username}: Followers: ${profileData.followers}, Following: ${profileData.following}, Ratio: ${profileData.ratio}, Posts: ${profileData.posts}, Latest Post Age Days: ${profileData.latestPostAgeDays}, Bio: ${profileData.bio}`);
      await this.navigateBack();
      await delay(this.settings.actionDelay);
    } else {
      console.log(`No need to load Profile page for ${username} - detailed criteria not enabled`);
      profileData = {
        username: username,
        followers: followers,
        following: following,
        posts: null,
        ratio: 'N/A',
        bio: bio,
        latestPostAgeDays: null
      };
      console.log(`Continuing with profile data: ${JSON.stringify(profileData)}`);
    }

    // Final decision logic - user should be removed if they meet ANY of the enabled criteria
    const shouldRemove = 
      (this.maxFollowers !== null && profileData.followers < this.maxFollowers) ||
      (this.minFollowing !== null && profileData.following > this.minFollowing) ||
      (this.maxPosts !== null && profileData.posts !== null && profileData.posts <= this.maxPosts) ||
      (this.minPostAgeDays !== null && profileData.latestPostAgeDays !== null && profileData.latestPostAgeDays >= this.minPostAgeDays) ||
      (this.bioMatchesText !== null && profileData.bio && profileData.bio.toLowerCase().includes(this.bioMatchesText.toLowerCase()));

    if (shouldRemove) {
      console.log(`User ${username} ${this.isDryRun ? 'would be' : 'will be'} removed.`);
      try {
        if (!this.isDryRun) {
          const removed = await this.removeFollower(username);
          if (removed) {
            this.removedCount++;
            this.removedProfiles.push(username);
          } else {
            this.keptCount++;
          }
        } else {
          console.log(`[DRY RUN] Would remove ${username}`);
          this.removedCount++;
          this.removedProfiles.push(username);
        }
      } catch (error) {
        console.error(`Error processing follower ${username}:`, error);
      }
    } else {
      this.keptCount++;
    }

    await delay(this.settings.actionDelay);
  }

  public async processFollowers(): Promise<void> {
    console.log("Starting to process followers");
    try {
      await this.scrollToTop();

      let lastProcessedUsername: string | null = null;
      let followerCount = 0;
      let noNewFollowersCount = 0;
      let foundSkipUsername = !this.skipUntilUsername; // If no skip username, start processing immediately

      // Skip until we find the specified username
      if (this.skipUntilUsername && !foundSkipUsername) {
        console.log(`Skipping until username: ${this.skipUntilUsername}`);
        while (!foundSkipUsername && !this.stopCleaning) {
          const nextFollower = await this.findNextFollower(lastProcessedUsername);
          if (nextFollower) {
            lastProcessedUsername = nextFollower.username;
            noNewFollowersCount = 0;
            
            // Check if we found the username to skip until
            if (nextFollower.username === this.skipUntilUsername) {
              console.log(`Found skip username: ${this.skipUntilUsername}. Starting processing from next follower.`);
              foundSkipUsername = true;
            }
          } else {
            await this.scrollDown();
            noNewFollowersCount++;
            if (noNewFollowersCount >= 5) {
              console.log(`Could not find skip username: ${this.skipUntilUsername}. Starting processing from current position.`);
              foundSkipUsername = true;
              break;
            }
          }
        }
      }

      noNewFollowersCount = 0;

      while (!this.stopCleaning) {
        console.log(`[Processing Loop] Looking for next follower after: ${lastProcessedUsername || 'start'}`);
        
        // Check stop flag before each operation
        if (this.stopCleaning) {
          console.log("[Processing Loop] Stop requested, exiting loop");
          break;
        }
        
        const nextFollower = await this.findNextFollower(lastProcessedUsername);

        if (this.stopCleaning) {
          console.log("[Processing Loop] Stop requested, exiting loop");
          break;
        }

        if (nextFollower) {
          console.log(`[Processing Loop] Found next follower: ${nextFollower.username}`);
          noNewFollowersCount = 0;
          await this.processFollower(nextFollower);
          
          // Check stop flag after processing
          if (this.stopCleaning) {
            console.log("[Processing Loop] Stop requested, exiting loop");
            break;
          }
          
          lastProcessedUsername = nextFollower.username;
          followerCount++;

          // Send updateProgress without callback - it's a fire-and-forget notification
          chrome.runtime.sendMessage({
            action: 'updateProgress',
            kept: this.keptCount,
            removed: this.removedCount
          });
        } else {
          console.log(`[Processing Loop] No follower found, scrolling...`);
          await this.scrollDown();
          
          // Check stop flag after scrolling
          if (this.stopCleaning) {
            console.log("[Processing Loop] Stop requested, exiting loop");
            break;
          }
          
          noNewFollowersCount++;

          if (noNewFollowersCount >= 5) {
            console.log("[Processing Loop] No new followers found after multiple scrolls. Assuming end of list.");
            break;
          }
        }
      }

      console.log("Processing complete.");
      console.log(`Total processed: ${followerCount}`);
      console.log(`Kept: ${this.keptCount}`);
      console.log(`Removed: ${this.removedCount}`);
      console.log("Removed profiles:", this.removedProfiles);

      chrome.runtime.sendMessage({
        action: 'cleaningComplete',
        kept: this.keptCount,
        removed: this.removedCount
      });
    } catch (error) {
      console.error("Error during follower processing:", error);
      chrome.runtime.sendMessage({
        action: 'cleaningError',
        error: (error as Error).message
      });
    }
  }

  public start(settings: ContentMessage): void {
    if (settings.action === 'start' && settings.pageType === 'followers') {
      this.maxFollowers = settings.maxFollowers;
      this.minFollowing = settings.minFollowing;
      this.maxPosts = settings.maxPosts;
      this.skipUntilUsername = settings.skipUntilUsername || null;
      this.maxUsernameDigits = settings.usernameDigits;
      this.minPostAgeDays = settings.minPostAgeDays;
      this.bioMatchesText = settings.bioMatchesText;
      this.isDryRun = settings.isDryRun;
      this.removeBlacklistedCountries = settings.removeBlacklistedCountries || false;
      this.blacklistedCountries = new Set(settings.blacklistedCountries || []);
      this.stopCleaning = false;
      this.usernamesToRemove = new Set(settings.usernamesToRemove || []);

      console.log(`Starting cleaning with settings:`, settings);
      this.processFollowers().catch(error => {
        console.error("Error in processFollowers:", error);
        chrome.runtime.sendMessage({
          action: 'cleaningError',
          error: error.message
        });
      });
    }
  }

  public stop(): void {
    this.stopCleaning = true;
    console.log("Received stop cleaning request");
  }

}

// Initialize the cleaner
const cleaner = new FollowerCleaner();

chrome.runtime.onMessage.addListener((request: ContentMessage, sender, sendResponse) => {
  if (request.action === 'start' && request.pageType === 'followers') {
    cleaner.start(request);
    sendResponse({ received: true });
  } else if (request.action === 'stopCleaning') {
    cleaner.stop();
    sendResponse({ stopped: true });
  }
});

console.log("Content script loaded. Waiting for start message.");