import React, { useState, useEffect } from 'react';
import './App.css';

const App = () => {
  const [songInput, setSongInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chordSheet, setChordSheet] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [spotifyResults, setSpotifyResults] = useState([]);
  const [searchType, setSearchType] = useState('general'); // 'general', 'spotify', 'youtube'
  const [spotifyToken, setSpotifyToken] = useState(null);
  const [showChordGraphs, setShowChordGraphs] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

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
    try {
      const urlObj = new URL(url);
      const videoId = urlObj.searchParams.get('v');
      if (videoId) {
        // Extract title from URL or use video ID
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
              content: `You are a professional ukulele instructor. Create clean, accurate ukulele chord sheets with chords positioned exactly above the lyrics.

🎵 UKULELE CHORD SHEET RULES:

1. CHORD POSITIONING: Place chords directly above the syllable where they change
2. UKULELE CHORDS: Use standard ukulele fingerings (C, G, Am, F, D, A, E, Em, Dm, C7, G7, F7, etc.)
3. SONG STRUCTURE: Clearly mark [Intro], [Verse], [Chorus], [Bridge], [Outro]
4. STRUMMING PATTERNS: Include clear strumming directions like:
   - D-D-U-U-D-U (Down-Down-Up-Up-Down-Up)
   - D-U-X-U-D-U (Down-Up-Mute-Up-Down-Up)
   - D-U-D-U (simple down-up pattern)
5. KEY & TEMPO: Specify key signature and suggested BPM
6. DIFFICULTY: Mark as Beginner/Intermediate/Advanced
${showChordGraphs ? '7. CHORD DIAGRAMS: Include simple fingering charts for any complex chords' : ''}

EXAMPLE FORMAT:
**Song Title** - Key of C - BPM: 120 - Difficulty: Beginner
Strumming: D-D-U-U-D-U

[Verse 1]
C              G           Am          F
Twinkle twinkle little star, how I wonder what you are
C              G           Am         F
Up above the world so high, like a diamond in the sky

Focus on accuracy and readability. Make it perfect for ukulele players of all levels.`
            },
            {
              role: 'user',
              content: `Create a professional ukulele chord sheet for: "${songInput}". 

If this is a real song, provide accurate chords and lyrics with proper chord positioning. If you don't know this exact song, create an inspiring chord progression and meaningful lyrics that fit the title. Include strumming patterns and make it perfect for ukulele.`
            }
          ],
          max_tokens: 1000,
          temperature: 0.7
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
        id: Date.now()
      };

      setChordSheet(generatedSheet);
      saveToHistory(generatedSheet);
      
    } catch (err) {
      console.error('Error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!chordSheet) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${chordSheet.title} - Ukulele Chords</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');
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
              font-family: 'Roboto', sans-serif;
              font-size: 2.5rem;
              color: #8b4513;
              margin-bottom: 10px;
              font-weight: 700;
            }
            .subtitle {
              color: #8b4513;
              font-size: 1.1rem;
              opacity: 0.8;
            }
            pre {
              white-space: pre-wrap;
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
            <div class="subtitle">Professional Ukulele Chord Sheet</div>
          </div>
          <pre>${chordSheet.content}</pre>
          <div class="footer">
            <div>Generated ${new Date(chordSheet.timestamp).toLocaleDateString()}</div>
            <div style="margin-top: 10px; font-style: italic;">Perfect for ukulele players of all levels</div>
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
          <p className="subtitle">Clean chord sheets with perfect positioning 🎸</p>
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
                      Include Chord Diagrams
                    </label>
                  </div>
                </div>
              )}
            </div>
            
            {/* Generate Button */}
            <div className="generate-section">
              <button 
                onClick={generateChordSheet}
                disabled={loading || !songInput.trim()}
                className="generate-btn"
              >
                {loading ? (
                  <span className="loading">
                    <span className="spinner"></span> Generating...
                  </span>
                ) : (
                  '🎸 Generate Chord Sheet'
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
                    <div className="history-date">
                      {new Date(sheet.timestamp).toLocaleDateString()}
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
          <p>🎸 Clean Ukulele Chord Sheets • Powered by AI</p>
        </div>
      </footer>
    </div>
  );
};

export default App;