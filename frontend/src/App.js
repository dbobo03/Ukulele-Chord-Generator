import React, { useState, useEffect } from 'react';
import './App.css';

const App = () => {
  const [songInput, setSongInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chordSheet, setChordSheet] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [spotifyResults, setSpotifyResults] = useState([]);
  const [searchType, setSearchType] = useState('general');
  const [spotifyToken, setSpotifyToken] = useState(null);
  const [showChordGraphs, setShowChordGraphs] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [previousSearch, setPreviousSearch] = useState(null);
  const [lyricsSource, setLyricsSource] = useState('found'); // 'found', 'manual', 'not_found'
  const [manualLyrics, setManualLyrics] = useState('');

  useEffect(() => {
    const savedHistory = localStorage.getItem('ukuleleHistory');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
    getSpotifyToken();
  }, []);

  const getSpotifyToken = async () => {
    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(process.env.REACT_APP_SPOTIFY_CLIENT_ID + ':' + process.env.REACT_APP_SPOTIFY_CLIENT_SECRET)}`
        },
        body: 'grant_type=client_credentials'
      });
      
      const data = await response.json();
      if (data.access_token) {
        setSpotifyToken(data.access_token);
      }
    } catch (err) {
      console.error('Failed to get Spotify token:', err);
    }
  };

  const getSpotifyAudioFeatures = async (trackId) => {
    if (!spotifyToken || !trackId) return null;
    
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/audio-features/${trackId}`,
        {
          headers: {
            'Authorization': `Bearer ${spotifyToken}`
          }
        }
      );
      
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error('Failed to get audio features:', err);
    }
    return null;
  };

  const searchLyrics = async (artist, title) => {
    // Try multiple free lyrics APIs
    const sources = [
      { name: 'Lyrics.ovh', url: `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}` },
      // Add more free APIs as fallbacks
    ];

    for (const source of sources) {
      try {
        const response = await fetch(source.url);
        if (response.ok) {
          const data = await response.json();
          if (data.lyrics && data.lyrics.trim()) {
            return {
              lyrics: data.lyrics.trim(),
              source: source.name
            };
          }
        }
      } catch (err) {
        console.log(`${source.name} failed:`, err);
        continue;
      }
    }
    
    return null;
  };

  const extractYouTubeTitle = (url) => {
    try {
      const urlObj = new URL(url);
      const videoId = urlObj.searchParams.get('v');
      if (videoId) {
        return `YouTube Video (${videoId})`;
      }
    } catch (err) {
      return null;
    }
    return null;
  };

  const searchSpotify = async (query) => {
    if (!spotifyToken || !query.trim()) {
      setSpotifyResults([]);
      return;
    }

    try {
      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=8`,
        {
          headers: {
            'Authorization': `Bearer ${spotifyToken}`
          }
        }
      );

      const data = await response.json();
      if (data.tracks && data.tracks.items) {
        setSpotifyResults(data.tracks.items);
      }
    } catch (err) {
      console.error('Spotify search failed:', err);
      setSpotifyResults([]);
    }
  };

  const selectSpotifyTrack = async (track) => {
    const songTitle = `${track.artists[0].name} - ${track.name}`;
    setSongInput(songTitle);
    setSpotifyResults([]);
    
    // Get audio features for better accuracy
    const audioFeatures = await getSpotifyAudioFeatures(track.id);
    
    // Try to get real lyrics
    const lyricsData = await searchLyrics(track.artists[0].name, track.name);
    
    // Store track data for generation
    window.currentTrackData = {
      track: track,
      audioFeatures: audioFeatures,
      lyrics: lyricsData
    };
  };

  const saveToHistory = (sheet) => {
    const newHistory = [sheet, ...history.slice(0, 9)];
    setHistory(newHistory);
    localStorage.setItem('ukuleleHistory', JSON.stringify(newHistory));
  };

  const generateChordSheet = async () => {
    if (!songInput.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const trackData = window.currentTrackData || {};
      const { audioFeatures, lyrics: foundLyrics } = trackData;
      
      let systemPrompt = `You are a professional ukulele instructor and music transcriptionist. Create accurate ukulele chord sheets with precise chord positioning.

🎵 UKULELE CHORD SHEET REQUIREMENTS:

1. ACCURACY: Use only real, accurate information - NO made-up lyrics
2. CHORD POSITIONING: Place chords directly above the exact syllable where they change
3. UKULELE CHORDS: Use proper ukulele fingerings (C, G, Am, F, D, A, E, Em, Dm, C7, G7, F7)
4. SONG STRUCTURE: Clear [Intro], [Verse], [Chorus], [Bridge], [Outro] sections
5. STRUMMING PATTERNS: Include specific patterns like D-D-U-U-D-U, D-U-X-U-D-U
6. PROFESSIONAL FORMAT: Key, BPM, difficulty level, chord diagrams
${showChordGraphs ? '7. CHORD DIAGRAMS: Include ASCII fingering charts for complex chords' : ''}

${audioFeatures ? `
SPOTIFY AUDIO ANALYSIS:
- Key: ${getKeyName(audioFeatures.key, audioFeatures.mode)}
- Tempo: ${Math.round(audioFeatures.tempo)} BPM
- Energy: ${Math.round(audioFeatures.energy * 100)}%
- Danceability: ${Math.round(audioFeatures.danceability * 100)}%
Use this data for accurate chord progressions and strumming patterns.
` : ''}

CRITICAL RULE: If you don't know the exact lyrics, state "Lyrics not found - please provide them manually" instead of creating fake lyrics.`;

      let userPrompt;
      
      if (foundLyrics && foundLyrics.lyrics) {
        // We found real lyrics
        userPrompt = `Create a professional ukulele chord sheet for: "${songInput}"

REAL LYRICS FOUND:
${foundLyrics.lyrics}

Use these EXACT lyrics with accurate chord positioning. Do not modify the lyrics.`;
        setLyricsSource('found');
      } else if (manualLyrics.trim()) {
        // User provided manual lyrics
        userPrompt = `Create a professional ukulele chord sheet for: "${songInput}"

USER-PROVIDED LYRICS:
${manualLyrics}

Use these EXACT lyrics with accurate chord positioning. Do not modify the lyrics.`;
        setLyricsSource('manual');
      } else {
        // No lyrics found - ask for manual input
        setLyricsSource('not_found');
        setError('Lyrics not found for this song. Please provide the lyrics manually below, or we can create a chord-only arrangement.');
        setLoading(false);
        return;
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama3-8b-8192',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 1200,
          temperature: 0.3 // Lower temperature for more accuracy
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const generatedSheet = {
        title: songInput,
        content: data.choices[0].message.content,
        timestamp: new Date().toISOString(),
        id: Date.now(),
        source: foundLyrics ? foundLyrics.source : 'manual',
        audioFeatures: audioFeatures
      };

      setChordSheet(generatedSheet);
      saveToHistory(generatedSheet);
      setManualLyrics(''); // Clear manual lyrics after successful generation
      
    } catch (err) {
      console.error('Error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateChordOnlySheet = async () => {
    if (!songInput.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const trackData = window.currentTrackData || {};
      const { audioFeatures } = trackData;
      
      const systemPrompt = `You are a professional ukulele instructor. Create a chord-only arrangement (no lyrics) with chord progressions and playing instructions.

🎵 CHORD-ONLY ARRANGEMENT:

1. CHORD PROGRESSIONS: Create logical verse/chorus/bridge progressions
2. UKULELE CHORDS: Use proper ukulele fingerings
3. STRUMMING PATTERNS: Multiple pattern suggestions
4. SONG STRUCTURE: Clear sections with chord changes
5. PLAYING TIPS: Tempo, dynamics, transitions
${showChordGraphs ? '6. CHORD DIAGRAMS: Include fingering charts' : ''}

${audioFeatures ? `
SPOTIFY AUDIO ANALYSIS:
- Key: ${getKeyName(audioFeatures.key, audioFeatures.mode)}
- Tempo: ${Math.round(audioFeatures.tempo)} BPM
- Energy: ${Math.round(audioFeatures.energy * 100)}%
Use this for accurate progressions.
` : ''}

Format as a professional lead sheet with chord symbols and structure.`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama3-8b-8192',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Create a chord-only ukulele arrangement for: "${songInput}"` }
          ],
          max_tokens: 800,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const generatedSheet = {
        title: songInput + ' (Chord-Only)',
        content: data.choices[0].message.content,
        timestamp: new Date().toISOString(),
        id: Date.now(),
        source: 'chord-only',
        audioFeatures: audioFeatures
      };

      setChordSheet(generatedSheet);
      saveToHistory(generatedSheet);
      setLyricsSource('found'); // Reset state
      
    } catch (err) {
      console.error('Error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getKeyName = (key, mode) => {
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const keyName = keys[key] || 'Unknown';
    const modeName = mode === 1 ? 'Major' : 'Minor';
    return `${keyName} ${modeName}`;
  };

  const exportToPDF = () => {
    if (!chordSheet) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${chordSheet.title} - Ukulele Chords</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&family=Courier+New&display=swap');
            body {
              font-family: 'Times New Roman', serif;
              margin: 40px;
              line-height: 1.8;
              color: #2c1810;
              background: linear-gradient(135deg, #f4e4bc 0%, #f0dcb4 100%);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 3px solid #8b4513;
              padding-bottom: 20px;
            }
            h1 {
              font-family: 'Times New Roman', serif;
              font-size: 2.5rem;
              color: #8b4513;
              margin-bottom: 10px;
              font-weight: bold;
            }
            .source-info {
              color: #8b4513;
              font-size: 1rem;
              opacity: 0.8;
              margin: 10px 0;
            }
            pre {
              white-space: pre-wrap;
              font-family: 'Courier New', monospace;
              font-size: 14px;
              background: rgba(255, 255, 255, 0.8);
              padding: 30px;
              border-radius: 15px;
              border: 2px solid #8b4513;
              line-height: 1.9;
              box-shadow: 0 8px 32px rgba(139, 69, 19, 0.2);
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              font-size: 12px;
              color: #8b4513;
              border-top: 2px solid #8b4513;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎸 ${chordSheet.title}</h1>
            ${chordSheet.source && chordSheet.source !== 'manual' ? 
              `<div class="source-info">Lyrics source: ${chordSheet.source}</div>` : ''}
            ${chordSheet.audioFeatures ? 
              `<div class="source-info">Enhanced with Spotify Audio Analysis</div>` : ''}
          </div>
          <pre>${chordSheet.content}</pre>
          <div class="footer">
            <div>Professional Ukulele Arrangement • ${new Date(chordSheet.timestamp).toLocaleDateString()}</div>
            <div style="margin-top: 10px; font-style: italic;">Generated with accuracy and precision</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const loadFromHistory = (sheet) => {
    setChordSheet(sheet);
    setSongInput(sheet.title);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSongInput(value);
    
    if (searchType === 'spotify' && value.length > 2) {
      searchSpotify(value);
    } else if (searchType === 'youtube' && value.includes('youtube.com')) {
      const title = extractYouTubeTitle(value);
      if (title) {
        setSongInput(title);
      }
    } else {
      setSpotifyResults([]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      generateChordSheet();
    }
  };

  const handleSearchTypeChange = (newType) => {
    // Save current search as previous
    if (songInput.trim()) {
      setPreviousSearch({
        query: songInput,
        type: searchType,
        timestamp: Date.now()
      });
    }
    
    // Clear current search and change type
    setSongInput('');
    setSpotifyResults([]);
    setSearchType(newType);
    setError('');
    setLyricsSource('found');
    setManualLyrics('');
  };

  const restorePreviousSearch = () => {
    if (previousSearch) {
      setSongInput(previousSearch.query);
      setSearchType(previousSearch.type);
      setPreviousSearch(null);
    }
  };

  const getPlaceholderText = () => {
    switch (searchType) {
      case 'spotify':
        return "🎵 Search Spotify songs... (e.g., 'Perfect Ed Sheeran')";
      case 'youtube':
        return "📺 Paste YouTube URL... (e.g., 'https://youtube.com/watch?v=...')";
      default:
        return "🎵 Enter any song title... (e.g., 'Over the Rainbow')";
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="title">
            <span className="title-text">Ukulele Chord Generator</span>
          </h1>
          <p className="subtitle">Accurate chord sheets with real lyrics 🎸</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="container">
          
          {/* Search Type Selector */}
          <div className="search-type-selector">
            <button 
              onClick={() => handleSearchTypeChange('general')}
              className={`search-type-btn ${searchType === 'general' ? 'active' : ''}`}
            >
              🌐 General
            </button>
            <button 
              onClick={() => handleSearchTypeChange('spotify')}
              className={`search-type-btn ${searchType === 'spotify' ? 'active' : ''}`}
            >
              🎵 Spotify
            </button>
            <button 
              onClick={() => handleSearchTypeChange('youtube')}
              className={`search-type-btn ${searchType === 'youtube' ? 'active' : ''}`}
            >
              📺 YouTube
            </button>
          </div>

          {/* Previous Search */}
          {previousSearch && (
            <div className="previous-search">
              <span className="previous-label">Previous search:</span>
              <button 
                onClick={restorePreviousSearch}
                className="previous-search-btn"
              >
                📝 "{previousSearch.query}" ({previousSearch.type})
              </button>
            </div>
          )}

          {/* Input Section */}
          <div className="input-section">
            <div className="search-container">
              <div className="input-wrapper">
                <input
                  type="text"
                  value={songInput}
                  onChange={handleInputChange}
                  placeholder={getPlaceholderText()}
                  className="song-input"
                  onKeyPress={handleKeyPress}
                />
                
                {/* Spotify Search Results */}
                {searchType === 'spotify' && spotifyResults.length > 0 && (
                  <div className="spotify-results">
                    {spotifyResults.map((track) => (
                      <div 
                        key={track.id}
                        className="spotify-result-item"
                        onClick={() => selectSpotifyTrack(track)}
                      >
                        <div className="track-info">
                          <div className="track-name">{track.name}</div>
                          <div className="track-artist">{track.artists.map(a => a.name).join(', ')}</div>
                          <div className="track-meta">
                            {track.album.name} • {track.popularity}% popularity
                          </div>
                        </div>
                        {track.album.images[2] && (
                          <img 
                            src={track.album.images[2].url} 
                            alt={track.album.name}
                            className="album-art"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Manual Lyrics Input */}
            {lyricsSource === 'not_found' && (
              <div className="manual-lyrics-section">
                <label className="lyrics-label">
                  Provide the real lyrics for accurate chord positioning:
                </label>
                <textarea
                  value={manualLyrics}
                  onChange={(e) => setManualLyrics(e.target.value)}
                  placeholder="Paste the real song lyrics here..."
                  className="manual-lyrics-input"
                  rows={8}
                />
              </div>
            )}

            {/* Settings */}
            <div className="settings-panel">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="settings-toggle"
              >
                ⚙️ Settings
              </button>
              
              {showSettings && (
                <div className="settings-content">
                  <div className="setting-group">
                    <label className="setting-label">
                      <input
                        type="checkbox"
                        checked={showChordGraphs}
                        onChange={(e) => setShowChordGraphs(e.target.checked)}
                        className="setting-checkbox"
                      />
                      Include Chord Diagrams (Visual Fingering Charts)
                    </label>
                  </div>
                </div>
              )}
            </div>
            
            {/* Generate Buttons */}
            <div className="generate-section">
              {lyricsSource === 'not_found' ? (
                <div className="generate-options">
                  <button 
                    onClick={generateChordSheet}
                    disabled={loading || !songInput.trim() || !manualLyrics.trim()}
                    className="generate-btn primary"
                  >
                    {loading ? (
                      <span className="loading">
                        <span className="spinner"></span> Generating...
                      </span>
                    ) : (
                      '🎸 Generate with Manual Lyrics'
                    )}
                  </button>
                  <span className="or-divider">or</span>
                  <button 
                    onClick={generateChordOnlySheet}
                    disabled={loading || !songInput.trim()}
                    className="generate-btn secondary"
                  >
                    🎼 Generate Chord-Only Sheet
                  </button>
                </div>
              ) : (
                <button 
                  onClick={generateChordSheet}
                  disabled={loading || !songInput.trim()}
                  className="generate-btn primary"
                >
                  {loading ? (
                    <span className="loading">
                      <span className="spinner"></span> Generating...
                    </span>
                  ) : (
                    '🎸 Generate Accurate Chord Sheet'
                  )}
                </button>
              )}
            </div>
            
            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Results Section */}
          {chordSheet && (
            <div className="results-section">
              <div className="result-header">
                <h2 className="result-title">🎵 {chordSheet.title}</h2>
                <div className="result-actions">
                  <button onClick={exportToPDF} className="export-btn">
                    📄 Export PDF
                  </button>
                  <span className="timestamp">
                    {new Date(chordSheet.timestamp).toLocaleDateString()}
                  </span>
                  {chordSheet.source && (
                    <span className="source-badge">
                      📝 {chordSheet.source}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="chord-sheet">
                <pre className="chord-content">{chordSheet.content}</pre>
              </div>
            </div>
          )}

          {/* History Section */}
          {history.length > 0 && (
            <div className="history-section">
              <h3 className="history-title">📚 Recent Sessions</h3>
              <div className="history-grid">
                {history.map((sheet) => (
                  <div 
                    key={sheet.id} 
                    className="history-item"
                    onClick={() => loadFromHistory(sheet)}
                  >
                    <div className="history-title-text">🎵 {sheet.title}</div>
                    <div className="history-meta">
                      {sheet.source && <span className="history-source">{sheet.source}</span>}
                      <span className="history-date">
                        {new Date(sheet.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <p>🎸 Accurate Ukulele Chord Sheets • Real Lyrics • Enhanced with AI</p>
        </div>
      </footer>
    </div>
  );
};

export default App;