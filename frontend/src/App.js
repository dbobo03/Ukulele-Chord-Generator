import React, { useState, useEffect } from 'react';
import './App.css';

const App = () => {
  const [songInput, setSongInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chordSheet, setChordSheet] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('ukuleleHistory');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  const saveToHistory = (sheet) => {
    const newHistory = [sheet, ...history.slice(0, 9)]; // Keep last 10
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
              content: `You are a master ukulele instructor and Hawaiian musician with 30+ years of experience. Create beautiful, authentic ukulele chord sheets that capture the aloha spirit. 

🎵 UKULELE MASTERY RULES:
1. AUTHENTIC CHORDS: Use traditional ukulele fingerings - C, G, Am, F, D, A, E, Em, Dm, C7, G7, F7
2. HAWAIIAN STYLE: Include classic progressions like vi-IV-I-V and ii-V-I 
3. PERFECT TIMING: Place chords exactly above the syllable where they change
4. SONG STRUCTURE: Clearly mark [Intro], [Verse], [Chorus], [Bridge], [Outro] 
5. STRUMMING: Suggest Island-style strum patterns (D-D-U-U-D-U)
6. CHORD DIAGRAMS: Show finger positions for complex chords
7. ALOHA SPIRIT: Add encouraging notes and Hawaiian musical tips

🌺 FORMAT EXAMPLE:
[Intro] - C - G - Am - F

[Verse 1]
C              G           Am          F
Somewhere over the rainbow, way up high
C              G           Am         F
There's a land that I heard of, once in a lullaby

[Chorus]
F              C           G           Am
Somewhere over the rainbow, skies are blue
F              C           G          Am        F
And the dreams that you dare to dream really do come true

🎸 Always include:
- Key signature and capo info
- Strum pattern suggestion  
- Difficulty level (Beginner/Intermediate/Advanced)
- Hawaiian musical wisdom

Create something that brings joy and aloha to the player! 🌺`
            },
            {
              role: 'user',
              content: `Create a beautiful ukulele chord sheet for: "${songInput}". 

If this is a real song, provide accurate chords and lyrics. If you don't know this exact song, create an inspiring chord progression and meaningful lyrics that capture the essence of the title. Make it perfect for ukulele - warm, melodic, and full of aloha spirit! 🌺🎵`
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
      setError('Oops! The ukulele spirits are taking a break 🌺 Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    if (!chordSheet) return;
    
    // Create a new window for printing with Hawaiian styling
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${chordSheet.title} - Ukulele Chords</title>
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
              border-bottom: 3px solid #d4a574;
              padding-bottom: 20px;
            }
            h1 {
              font-family: 'Caveat', cursive;
              font-size: 2.5rem;
              color: #ff6b35;
              margin-bottom: 10px;
              text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
            }
            .subtitle {
              color: #8b4513;
              font-style: italic;
              font-size: 1.1rem;
            }
            pre {
              white-space: pre-wrap;
              font-size: 14px;
              background: rgba(255, 255, 255, 0.7);
              padding: 30px;
              border-radius: 15px;
              border: 2px solid #d4a574;
              line-height: 1.9;
              box-shadow: 0 8px 32px rgba(139, 69, 19, 0.2);
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              font-size: 12px;
              color: #8b4513;
              border-top: 2px solid #d4a574;
              padding-top: 20px;
            }
            .decorative {
              font-size: 1.5rem;
              color: #ff6b35;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🌺 ${chordSheet.title} 🎵</h1>
            <div class="subtitle">Ukulele Chord Sheet • Aloha Style</div>
          </div>
          <pre>${chordSheet.content}</pre>
          <div class="footer">
            <div class="decorative">🏝️ 🎸 🌺 🎵 🏝️</div>
            <div>Generated with Aloha • ${new Date(chordSheet.timestamp).toLocaleDateString()}</div>
            <div style="margin-top: 10px; font-style: italic;">Play with joy and share the aloha spirit! 🌺</div>
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      generateChordSheet();
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="title">
            <span className="title-text">Aloha Ukulele</span>
          </h1>
          <p className="subtitle">Transform any song into beautiful Hawaiian-style chord sheets 🌺</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="container">
          
          {/* Input Section */}
          <div className="input-section">
            <div className="search-container">
              <input
                type="text"
                value={songInput}
                onChange={(e) => setSongInput(e.target.value)}
                placeholder="🎵 Enter any song title... (e.g., 'Over the Rainbow', 'Perfect', 'Hallelujah')"
                className="song-input"
                onKeyPress={handleKeyPress}
              />
              <button 
                onClick={generateChordSheet}
                disabled={loading || !songInput.trim()}
                className="generate-btn"
              >
                {loading ? (
                  <span className="loading">
                    <span className="spinner"></span> Creating Magic...
                  </span>
                ) : (
                  '🌺 Generate Chords'
                )}
              </button>
            </div>
            
            {error && (
              <div className="error-message">
                🌺 {error}
              </div>
            )}
          </div>

          {/* Results Section */}
          {chordSheet && (
            <div className="results-section">
              <div className="result-header">
                <h2 className="result-title">{chordSheet.title}</h2>
                <div className="result-actions">
                  <button onClick={exportToPDF} className="export-btn">
                    🏝️ Export PDF
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
              <h3 className="history-title">Recent Island Jams</h3>
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
          <p>🌺 Made with Aloha for Ukulele Lovers • Powered by AI Magic 🎵</p>
        </div>
      </footer>
    </div>
  );
};

export default App;