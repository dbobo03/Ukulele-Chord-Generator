import React, { useState, useEffect } from 'react';
import SpotifyAuth from '../services/SpotifyAuth';

const SpotifyLogin = ({ onLoginSuccess, onLoginError }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    checkLoginStatus();
    handlePageCallback();
  }, []);

  const checkLoginStatus = () => {
    const loggedIn = SpotifyAuth.isLoggedIn();
    setIsLoggedIn(loggedIn);
    
    if (loggedIn) {
      const profile = SpotifyAuth.getUserProfile();
      setUser(profile);
      onLoginSuccess && onLoginSuccess(profile);
    }
  };

  const handlePageCallback = async () => {
    try {
      const result = await SpotifyAuth.handlePageCallback();
      if (result) {
        if (result.success) {
          setIsLoggedIn(true);
          setUser(result.user);
          setError('');
          onLoginSuccess && onLoginSuccess(result.user);
        } else {
          handleLoginError(result);
        }
      }
    } catch (error) {
      console.error('Callback handling failed:', error);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    setShowRetry(false);

    try {
      const result = await SpotifyAuth.login();
      
      if (result.success) {
        if (result.method === 'redirect') {
          // Redirect in progress, don't update state
          return;
        }
        
        setIsLoggedIn(true);
        setUser(result.user);
        onLoginSuccess && onLoginSuccess(result.user);
      } else {
        handleLoginError(result);
      }
    } catch (error) {
      handleLoginError({
        success: false,
        error: 'unexpected_error',
        message: 'An unexpected error occurred during login.',
        canRetry: true
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLoginError = (result) => {
    setError(result.message);
    setShowRetry(result.canRetry);
    onLoginError && onLoginError(result);
  };

  const handleLogout = () => {
    const result = SpotifyAuth.logout();
    if (result.success) {
      setIsLoggedIn(false);
      setUser(null);
      setError('');
      setShowRetry(false);
    }
  };

  const handleRetry = () => {
    setError('');
    setShowRetry(false);
    handleLogin();
  };

  if (isLoggedIn && user) {
    return (
      <div className="spotify-login-success">
        <div className="user-info">
          <div className="user-avatar">
            {user.images && user.images[0] ? (
              <img src={user.images[0].url} alt={user.display_name} />
            ) : (
              <div className="avatar-placeholder">
                {user.display_name?.charAt(0) || 'U'}
              </div>
            )}
          </div>
          <div className="user-details">
            <div className="user-name">{user.display_name || 'Spotify User'}</div>
            <div className="user-meta">
              {user.followers?.total ? `${user.followers.total} followers` : 'Spotify Premium'}
            </div>
          </div>
        </div>
        <button onClick={handleLogout} className="logout-btn">
          🔓 Logout
        </button>
      </div>
    );
  }

  return (
    <div className="spotify-login">
      {error && (
        <div className="login-error">
          <div className="error-message">❌ {error}</div>
          {showRetry && (
            <button onClick={handleRetry} className="retry-btn">
              🔄 Try Again
            </button>
          )}
        </div>
      )}
      
      <button 
        onClick={handleLogin}
        disabled={loading}
        className="spotify-login-btn"
      >
        {loading ? (
          <span className="loading">
            <span className="spinner"></span> Connecting to Spotify...
          </span>
        ) : (
          <>
            <span className="spotify-icon">🎵</span>
            Login with Spotify
          </>
        )}
      </button>
      
      <div className="login-benefits">
        <div className="benefit-item">✅ Access your playlists</div>
        <div className="benefit-item">✅ Recent listening history</div>
        <div className="benefit-item">✅ Saved songs library</div>
        <div className="benefit-item">✅ Enhanced audio analysis</div>
      </div>
    </div>
  );
};

export default SpotifyLogin;