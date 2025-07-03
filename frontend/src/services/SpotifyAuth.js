class SpotifyAuthService {
  constructor() {
    this.clientId = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.REACT_APP_SPOTIFY_CLIENT_SECRET;
    this.redirectUri = `${window.location.origin}`;
    this.scopes = [
      'user-read-private',
      'user-read-email', 
      'playlist-read-private',
      'playlist-read-collaborative',
      'user-library-read',
      'user-read-recently-played',
      'user-top-read'
    ];
    
    // Error handling setup
    this.errorMessages = {
      'access_denied': 'You cancelled the login. You can still use public search.',
      'invalid_client': 'App configuration error. Please contact support.',
      'invalid_grant': 'Login session expired. Please try again.',
      'invalid_request': 'Login request failed. Please try again.',
      'unauthorized_client': 'App not authorized. Please contact support.',
      'unsupported_response_type': 'Login method not supported.',
      'invalid_scope': 'Permissions error. Some features may be limited.',
      'server_error': 'Spotify servers are having issues. Please try later.',
      'temporarily_unavailable': 'Spotify login is temporarily unavailable.',
      'popup_blocked': 'Login popup was blocked. Please allow popups and try again.',
      'network_error': 'Network connection failed. Please check your internet.',
      'timeout_error': 'Login took too long. Please try again.',
      'state_mismatch': 'Security validation failed. Please try again.'
    };
  }

  // Generate secure random state for CSRF protection
  generateState() {
    const array = new Uint32Array(8);
    crypto.getRandomValues(array);
    return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
  }

  // Build authorization URL with all parameters
  getAuthUrl() {
    const state = this.generateState();
    sessionStorage.setItem('spotify_auth_state', state);
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: this.scopes.join(' '),
      redirect_uri: this.redirectUri,
      state: state,
      show_dialog: 'false' // Set to true for testing
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  // Main login method with comprehensive error handling
  async login() {
    try {
      // Validate environment variables
      if (!this.clientId || !this.clientSecret) {
        throw new Error('invalid_client');
      }

      // Clear any existing tokens
      this.clearTokens();

      const authUrl = this.getAuthUrl();
      console.log('🎵 Opening Spotify login...');

      // Try popup method first
      const result = await this.loginWithPopup(authUrl);
      
      if (result.success) {
        console.log('✅ Spotify login successful!');
        return result;
      } else {
        // Fallback to redirect method
        console.log('🔄 Popup failed, trying redirect method...');
        return await this.loginWithRedirect(authUrl);
      }

    } catch (error) {
      console.error('❌ Spotify login error:', error);
      return this.handleError(error);
    }
  }

  // Popup-based login (preferred method)
  async loginWithPopup(authUrl) {
    return new Promise((resolve) => {
      try {
        // Check if popups are blocked
        const popup = window.open(
          authUrl,
          'spotify-login',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          throw new Error('popup_blocked');
        }

        // Monitor popup
        const checkClosed = setInterval(() => {
          try {
            if (popup.closed) {
              clearInterval(checkClosed);
              clearTimeout(timeout);
              resolve({ success: false, error: 'user_cancelled' });
            }

            // Check for successful callback
            if (popup.location.href.includes('/callback')) {
              const url = new URL(popup.location.href);
              popup.close();
              clearInterval(checkClosed);
              clearTimeout(timeout);
              
              this.handleCallback(url)
                .then(result => resolve(result))
                .catch(error => resolve(this.handleError(error)));
            }
          } catch (e) {
            // Cross-origin error - popup still on Spotify domain
            // This is expected and normal
          }
        }, 1000);

        // Timeout after 5 minutes
        const timeout = setTimeout(() => {
          clearInterval(checkClosed);
          popup.close();
          resolve({ success: false, error: 'timeout_error' });
        }, 300000);

      } catch (error) {
        resolve(this.handleError(error));
      }
    });
  }

  // Redirect-based login (fallback method)
  async loginWithRedirect(authUrl) {
    try {
      // Store current page for return
      sessionStorage.setItem('spotify_return_url', window.location.href);
      
      // Redirect to Spotify
      window.location.href = authUrl;
      
      return { success: true, method: 'redirect' };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Handle OAuth callback
  async handleCallback(url) {
    try {
      const params = new URLSearchParams(url.search);
      const code = params.get('code');
      const state = params.get('state');
      const error = params.get('error');

      // Check for user denial or errors
      if (error) {
        throw new Error(error);
      }

      // Validate state parameter (CSRF protection)
      const savedState = sessionStorage.getItem('spotify_auth_state');
      if (!state || state !== savedState) {
        throw new Error('state_mismatch');
      }

      // Clear state
      sessionStorage.removeItem('spotify_auth_state');

      if (!code) {
        throw new Error('invalid_request');
      }

      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(code);
      
      // Get user profile
      const profile = await this.getUserProfile(tokens.access_token);

      // Store everything
      this.storeTokens(tokens);
      this.storeUserProfile(profile);

      return {
        success: true,
        user: profile,
        tokens: tokens,
        method: 'popup'
      };

    } catch (error) {
      return this.handleError(error);
    }
  }

  // Exchange authorization code for access tokens
  async exchangeCodeForTokens(code) {
    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'token_exchange_failed');
      }

      const tokens = await response.json();
      
      // Add expiration timestamp
      tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
      
      return tokens;

    } catch (error) {
      if (error.name === 'TypeError') {
        throw new Error('network_error');
      }
      throw error;
    }
  }

  // Get user profile information
  async getUserProfile(accessToken) {
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('profile_fetch_failed');
      }

      return await response.json();

    } catch (error) {
      if (error.name === 'TypeError') {
        throw new Error('network_error');
      }
      throw error;
    }
  }

  // Store tokens securely
  storeTokens(tokens) {
    try {
      localStorage.setItem('spotify_access_token', tokens.access_token);
      localStorage.setItem('spotify_refresh_token', tokens.refresh_token);
      localStorage.setItem('spotify_expires_at', tokens.expires_at.toString());
      localStorage.setItem('spotify_token_type', tokens.token_type || 'Bearer');
    } catch (error) {
      console.error('Failed to store tokens:', error);
      throw new Error('storage_error');
    }
  }

  // Store user profile
  storeUserProfile(profile) {
    try {
      localStorage.setItem('spotify_user_profile', JSON.stringify(profile));
    } catch (error) {
      console.error('Failed to store user profile:', error);
    }
  }

  // Get stored access token
  getAccessToken() {
    try {
      const token = localStorage.getItem('spotify_access_token');
      const expiresAt = localStorage.getItem('spotify_expires_at');
      
      if (!token || !expiresAt) {
        return null;
      }

      // Check if token is expired
      if (Date.now() >= parseInt(expiresAt)) {
        console.log('🔄 Access token expired, attempting refresh...');
        this.refreshToken();
        return null;
      }

      return token;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  // Refresh access token
  async refreshToken() {
    try {
      const refreshToken = localStorage.getItem('spotify_refresh_token');
      
      if (!refreshToken) {
        throw new Error('no_refresh_token');
      }

      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      });

      if (!response.ok) {
        throw new Error('refresh_failed');
      }

      const tokens = await response.json();
      tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
      
      // Update stored tokens
      this.storeTokens({
        ...tokens,
        refresh_token: tokens.refresh_token || refreshToken
      });

      return tokens.access_token;

    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearTokens();
      return null;
    }
  }

  // Get stored user profile
  getUserProfile() {
    try {
      const profile = localStorage.getItem('spotify_user_profile');
      return profile ? JSON.parse(profile) : null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  // Check if user is logged in
  isLoggedIn() {
    const token = this.getAccessToken();
    const profile = this.getUserProfile();
    return !!(token && profile);
  }

  // Logout user
  logout() {
    this.clearTokens();
    console.log('🔓 Logged out from Spotify');
    return { success: true, message: 'Logged out successfully' };
  }

  // Clear all stored data
  clearTokens() {
    const keys = [
      'spotify_access_token',
      'spotify_refresh_token', 
      'spotify_expires_at',
      'spotify_token_type',
      'spotify_user_profile'
    ];
    
    keys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Failed to remove ${key}:`, error);
      }
    });

    sessionStorage.removeItem('spotify_auth_state');
  }

  // Handle callback on page load (for redirect method)
  async handlePageCallback() {
    const url = new URL(window.location.href);
    
    if (url.pathname === '/callback' || url.search.includes('code=')) {
      console.log('🔄 Processing Spotify callback...');
      
      const result = await this.handleCallback(url);
      
      // Clean up URL
      window.history.replaceState({}, document.title, '/');
      
      // Return to original page if stored
      const returnUrl = sessionStorage.getItem('spotify_return_url');
      if (returnUrl && returnUrl !== window.location.href) {
        sessionStorage.removeItem('spotify_return_url');
        window.location.href = returnUrl;
        return result;
      }
      
      return result;
    }
    
    return null;
  }

  // Enhanced error handling
  handleError(error) {
    const errorCode = typeof error === 'string' ? error : error.message || 'unknown_error';
    const message = this.errorMessages[errorCode] || `Login failed: ${errorCode}`;
    
    console.error('🚨 Spotify Auth Error:', errorCode, message);
    
    return {
      success: false,
      error: errorCode,
      message: message,
      canRetry: this.isRetryableError(errorCode)
    };
  }

  // Determine if error is retryable
  isRetryableError(errorCode) {
    const retryableErrors = [
      'network_error',
      'timeout_error', 
      'server_error',
      'temporarily_unavailable',
      'popup_blocked'
    ];
    
    return retryableErrors.includes(errorCode);
  }

  // Get user's playlists
  async getUserPlaylists(limit = 20) {
    const token = this.getAccessToken();
    if (!token) return null;

    try {
      const response = await fetch(`https://api.spotify.com/v1/me/playlists?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('playlists_fetch_failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get playlists:', error);
      return null;
    }
  }

  // Get user's saved tracks
  async getSavedTracks(limit = 20) {
    const token = this.getAccessToken();
    if (!token) return null;

    try {
      const response = await fetch(`https://api.spotify.com/v1/me/tracks?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('saved_tracks_fetch_failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get saved tracks:', error);
      return null;
    }
  }

  // Get recently played tracks
  async getRecentlyPlayed(limit = 20) {
    const token = this.getAccessToken();
    if (!token) return null;

    try {
      const response = await fetch(`https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('recent_tracks_fetch_failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get recent tracks:', error);
      return null;
    }
  }
}

export default new SpotifyAuthService();