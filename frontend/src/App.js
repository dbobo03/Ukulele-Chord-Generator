import React, { useState, useEffect } from 'react';
import './App.css';

const App = () => {
  const [songInput, setSongInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chordSheets, setChordSheets] = useState([]);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [spotifyResults, setSpotifyResults] = useState([]);
  const [searchType, setSearchType] = useState('general'); // 'general', 'spotify', 'youtube'
  const [spotifyToken, setSpotifyToken] = useState(null);
  const [selectedStyles, setSelectedStyles] = useState(['strumming']);
  const [showChordGraphs, setShowChordGraphs] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const ukuleleStyles = [
    { id: 'strumming', name: 'Strumming', icon: '🎸', description: 'Classic down-up strumming patterns' },
    { id: 'fingerpicking', name: 'Fingerpicking', icon: '✋', description: 'Gentle finger-style playing' },
    { id: 'classical', name: 'Classical', icon: '🎼', description: 'Traditional classical technique' },
    { id: 'jazz', name: 'Jazz', icon: '🎷', description: 'Sophisticated jazz chord voicings' }
  ];

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

  const extractYouTubeTitle = (url) => {
    // Simple YouTube title extraction from URL
    try {
      const urlObj = new URL(url);
      const videoId = urlObj.searchParams.get('v');
      if (videoId) {
        // For now, return a placeholder - in production, you'd call YouTube API
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

  const selectSpotifyTrack = (track) => {
    const songTitle = `${track.artists[0].name} - ${track.name}`;
    setSongInput(songTitle);
    setSpotifyResults([]);
  };

  const saveToHistory = (sheets) => {
    const historyEntry = {
      title: songInput,
      sheets: sheets,
      timestamp: new Date().toISOString(),
      id: Date.now()
    };
    const newHistory = [historyEntry, ...history.slice(0, 9)];
    setHistory(newHistory);
    localStorage.setItem('ukuleleHistory', JSON.stringify(newHistory));
  };

  const generateChordSheets = async () => {
    if (!songInput.trim() || selectedStyles.length === 0) return;
    
    setLoading(true);
    setError('');
    setChordSheets([]);
    
    try {
      const generatedSheets = [];
      
      for (const style of selectedStyles) {
        const styleInfo = ukuleleStyles.find(s => s.id === style);
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: 'llama3-8b-8192',
            messages: [
              {
                role: 'system',
                content: `You are a professional ukulele instructor specializing in ${styleInfo.name} technique. Create authentic ukulele chord sheets with expert-level ${style} arrangements.

🎵 UKULELE EXPERTISE - ${styleInfo.name.toUpperCase()} STYLE:

${style === 'strumming' ? `
STRUMMING PATTERNS:
- Use classic patterns: D-D-U-U-D-U, D-U-X-U-D-U
- Include palm muting and accent techniques
- Focus on rhythm and groove
- Suggest tempo variations
` : style === 'fingerpicking' ? `
FINGERPICKING TECHNIQUES:
- Use PIMA fingering notation (P=thumb, I=index, M=middle, A=ring)
- Create flowing arpeggiated patterns
- Include bass-melody combinations
- Focus on gentle, melodic flow
` : style === 'classical' ? `
CLASSICAL TECHNIQUE:
- Use proper classical fingering positions
- Include rest stroke and free stroke notation
- Focus on precise timing and dynamics
- Add ornamentations and grace notes
` : `
JAZZ STYLING:
- Use sophisticated chord extensions (7ths, 9ths, 13ths)
- Include chord substitutions and variations
- Focus on syncopated rhythms
- Add swing feel notation
`}

CHORD REQUIREMENTS:
1. AUTHENTIC CHORDS: Use ukulele-friendly voicings
2. PERFECT TIMING: Place chords exactly above syllables
3. SONG STRUCTURE: Clear [Intro], [Verse], [Chorus], [Bridge] sections
4. TECHNIQUE NOTES: Include specific ${style} techniques
5. DIFFICULTY: Mark appropriate skill level
${showChordGraphs ? '6. CHORD DIAGRAMS: Include fingering charts for complex chords' : ''}

FORMAT: Professional music sheet with proper spacing and clear notation.`
              },
              {
                role: 'user',
                content: `Create a professional ${styleInfo.name} ukulele arrangement for: "${songInput}". 

Make it authentic to the ${style} style with appropriate techniques, chord voicings, and playing instructions. If you don't know this exact song, create an inspiring arrangement that captures the essence of the title using ${style} technique.`
              }
            ],
            max_tokens: 1200,
            temperature: 0.7
          })
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        generatedSheets.push({
          style: styleInfo,
          content: data.choices[0].message.content,
          timestamp: new Date().toISOString(),
          id: Date.now() + Math.random()
        });
      }

      setChordSheets(generatedSheets);
      saveToHistory(generatedSheets);
      
    } catch (err) {
      console.error('Error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = (sheet) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${songInput} - ${sheet.style.name} Style</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
            body {
              font-family: 'JetBrains Mono', monospace;
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
              font-family: 'Caveat', cursive;
              font-size: 2.5rem;
              color: #8b4513;
              margin-bottom: 10px;
            }
            .style-badge {
              background: #d4a574;
              color: white;
              padding: 8px 16px;
              border-radius: 20px;
              font-weight: bold;
              display: inline-block;
              margin: 10px 0;
            }
            pre {
              white-space: pre-wrap;
              font-size: 14px;
              background: rgba(255, 255, 255, 0.8);
              padding: 30px;
              border-radius: 15px;
              border: 2px solid #8b4513;
              line-height: 1.9;
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
            <h1>🎸 ${songInput}</h1>
            <div class="style-badge">${sheet.style.icon} ${sheet.style.name} Style</div>
          </div>
          <pre>${sheet.content}</pre>
          <div class="footer">
            <div>Professional Ukulele Arrangement • ${new Date(sheet.timestamp).toLocaleDateString()}</div>
            <div style="margin-top: 10px; font-style: italic;">Generated with precision and musicality</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const loadFromHistory = (historyItem) => {
    setChordSheets(historyItem.sheets);
    setSongInput(historyItem.title);
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
      generateChordSheets();
    }
  };

  const toggleStyle = (styleId) => {
    setSelectedStyles(prev => 
      prev.includes(styleId) 
        ? prev.filter(id => id !== styleId)
        : [...prev, styleId]
    );
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
            <span className="title-text">Ukulele Master</span>
          </h1>
          <p className="subtitle">Professional chord sheets for every playing style 🎸</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="container">
          
          {/* Search Type Selector */}
          <div className="search-type-selector">
            <button 
              onClick={() => setSearchType('general')}
              className={`search-type-btn ${searchType === 'general' ? 'active' : ''}`}
            >
              🌐 General
            </button>
            <button 
              onClick={() => setSearchType('spotify')}
              className={`search-type-btn ${searchType === 'spotify' ? 'active' : ''}`}
            >
              🎵 Spotify
            </button>
            <button 
              onClick={() => setSearchType('youtube')}
              className={`search-type-btn ${searchType === 'youtube' ? 'active' : ''}`}
            >
              📺 YouTube
            </button>
          </div>

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

            {/* Settings Panel */}
            <div className="settings-panel">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="settings-toggle"
              >
                ⚙️ Style Settings
              </button>
              
              {showSettings && (
                <div className="settings-content">
                  {/* Style Selection */}
                  <div className="setting-group">
                    <label className="setting-label">Playing Styles</label>
                    <div className="style-grid">
                      {ukuleleStyles.map((style) => (
                        <div 
                          key={style.id}
                          onClick={() => toggleStyle(style.id)}
                          className={`style-card ${selectedStyles.includes(style.id) ? 'selected' : ''}`}
                        >
                          <div className="style-icon">{style.icon}</div>
                          <div className="style-name">{style.name}</div>
                          <div className="style-desc">{style.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Chord Graphs Toggle */}
                  <div className="setting-group">
                    <label className="setting-label">
                      <input
                        type="checkbox"
                        checked={showChordGraphs}
                        onChange={(e) => setShowChordGraphs(e.target.checked)}
                        className="setting-checkbox"
                      />
                      Include Chord Diagrams
                    </label>
                  </div>
                </div>
              )}
            </div>
            
            {/* Generate Button */}
            <div className="generate-section">
              <button 
                onClick={generateChordSheets}
                disabled={loading || !songInput.trim() || selectedStyles.length === 0}
                className="generate-btn"
              >
                {loading ? (
                  <span className="loading">
                    <span className="spinner"></span> Creating {selectedStyles.length} Style{selectedStyles.length > 1 ? 's' : ''}...
                  </span>
                ) : (
                  `🎸 Generate ${selectedStyles.length} Style${selectedStyles.length > 1 ? 's' : ''}`
                )}
              </button>
            </div>
            
            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Results Section */}
          {chordSheets.length > 0 && (
            <div className="results-section">
              <div className="results-header">
                <h2 className="results-title">🎵 {songInput}</h2>
                <div className="results-meta">
                  {chordSheets.length} style{chordSheets.length > 1 ? 's' : ''} generated
                </div>
              </div>
              
              <div className="chord-sheets-grid">
                {chordSheets.map((sheet) => (
                  <div key={sheet.id} className="chord-sheet-card">
                    <div className="sheet-header">
                      <div className="style-badge">
                        {sheet.style.icon} {sheet.style.name}
                      </div>
                      <button 
                        onClick={() => exportToPDF(sheet)} 
                        className="export-btn"
                      >
                        📄 PDF
                      </button>
                    </div>
                    <div className="chord-sheet">
                      <pre className="chord-content">{sheet.content}</pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History Section */}
          {history.length > 0 && (
            <div className="history-section">
              <h3 className="history-title">📚 Recent Sessions</h3>
              <div className="history-grid">
                {history.map((item) => (
                  <div 
                    key={item.id} 
                    className="history-item"
                    onClick={() => loadFromHistory(item)}
                  >
                    <div className="history-title-text">🎵 {item.title}</div>
                    <div className="history-meta">
                      {item.sheets.length} style{item.sheets.length > 1 ? 's' : ''} • {new Date(item.timestamp).toLocaleDateString()}
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
          <p>🎸 Professional Ukulele Tool • Powered by AI</p>
        </div>
      </footer>
    </div>
  );
};

export default App;