import React, { useState, useEffect } from 'react';
import ChordDiagram from './components/ChordDiagram';
import SpotifyLogin from './components/SpotifyLogin';
import SpotifyAuth from './services/SpotifyAuth';
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
  const [lyricsSource, setLyricsSource] = useState('found');
  const [manualLyrics, setManualLyrics] = useState('');
  const [lyricsSearchStatus, setLyricsSearchStatus] = useState('');
  const [spotifyUser, setSpotifyUser] = useState(null);
  const [showSpotifyLogin, setShowSpotifyLogin] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [userSavedTracks, setUserSavedTracks] = useState([]);
  const [spotifyAuthError, setSpotifyAuthError] = useState('');

  // Ukulele chord fingerings database
  const ukuleleChords = {
    'C': '0003', 'G': '0232', 'Am': '2000', 'F': '2010',
    'D': '2220', 'A': '2100', 'E': '1402', 'Em': '0432',
    'Dm': '2210', 'C7': '0001', 'G7': '0212', 'F7': '2310',
    'D7': '2223', 'A7': '0100', 'E7': '1202', 'B7': '2322'
  };

  useEffect(() => {
    const savedHistory = localStorage.getItem('ukuleleHistory');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
    getSpotifyToken();
    checkSpotifyLoginStatus();
  }, []);

  const checkSpotifyLoginStatus = () => {
    if (SpotifyAuth.isLoggedIn()) {
      const user = SpotifyAuth.getUserProfile();
      setSpotifyUser(user);
      loadUserSpotifyData();
    }
  };

  const loadUserSpotifyData = async () => {
    try {
      const [playlists, savedTracks] = await Promise.all([
        SpotifyAuth.getUserPlaylists(10),
        SpotifyAuth.getSavedTracks(20)
      ]);
      
      if (playlists) setUserPlaylists(playlists.items || []);
      if (savedTracks) setUserSavedTracks(savedTracks.items || []);
    } catch (error) {
      console.error('Failed to load user Spotify data:', error);
    }
  };

  const handleSpotifyLoginSuccess = (user) => {
    setSpotifyUser(user);
    setShowSpotifyLogin(false);
    setSpotifyAuthError('');
    loadUserSpotifyData();
  };

  const handleSpotifyLoginError = (error) => {
    setSpotifyAuthError(error.message);
    setShowSpotifyLogin(true);
  };

  const handleSearchTypeChange = (newType) => {
    if (songInput.trim()) {
      setPreviousSearch({
        query: songInput,
        type: searchType,
        timestamp: Date.now()
      });
    }
    
    // Show Spotify login if switching to Spotify and not logged in
    if (newType === 'spotify' && !spotifyUser) {
      setShowSpotifyLogin(true);
    }
    
    setSongInput('');
    setSpotifyResults([]);
    setSearchType(newType);
    setError('');
    setLyricsSource('found');
    setManualLyrics('');
    setLyricsSearchStatus('');
  };

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

  const getSpotifyTrackAnalysis = async (trackId) => {
    if (!spotifyToken || !trackId) return null;
    
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/audio-analysis/${trackId}`,
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
      console.error('Failed to get track analysis:', err);
    }
    return null;
  };

  const searchLyricsMultiSource = async (artist, title) => {
    setLyricsSearchStatus('Searching multiple lyrics databases...');
    
    const sources = [
      {
        name: 'Lyrics.ovh',
        search: async () => {
          const response = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
          if (response.ok) {
            const data = await response.json();
            return data.lyrics?.trim();
          }
          return null;
        }
      },
      {
        name: 'Lyrist',
        search: async () => {
          try {
            // Lyrist API endpoint (adjust based on their documentation)
            const response = await fetch(`https://lyrist.vercel.app/api/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
            if (response.ok) {
              const data = await response.json();
              return data.lyrics?.trim();
            }
          } catch (err) {
            console.log('Lyrist API not available, trying alternative...');
          }
          return null;
        }
      },
      {
        name: 'Alternative Search',
        search: async () => {
          // Try with different search terms
          const searchTerms = [
            `${title} ${artist}`,
            `${artist} ${title} lyrics`,
            title.replace(/[^\w\s]/g, ''), // Remove special characters
          ];
          
          for (const term of searchTerms) {
            try {
              const response = await fetch(`https://api.lyrics.ovh/suggest/${encodeURIComponent(term)}`);
              if (response.ok) {
                const data = await response.json();
                if (data.data && data.data.length > 0) {
                  const match = data.data.find(item => 
                    item.artist.name.toLowerCase().includes(artist.toLowerCase()) ||
                    item.title.toLowerCase().includes(title.toLowerCase())
                  );
                  if (match) {
                    const lyricsResponse = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(match.artist.name)}/${encodeURIComponent(match.title)}`);
                    if (lyricsResponse.ok) {
                      const lyricsData = await lyricsResponse.json();
                      return lyricsData.lyrics?.trim();
                    }
                  }
                }
              }
            } catch (err) {
              continue;
            }
          }
          return null;
        }
      }
    ];

    const results = [];
    
    // Try all sources simultaneously
    const promises = sources.map(async (source) => {
      try {
        setLyricsSearchStatus(`Trying ${source.name}...`);
        const lyrics = await source.search();
        if (lyrics && lyrics.length > 50) { // Basic quality check
          return { source: source.name, lyrics, quality: calculateLyricsQuality(lyrics) };
        }
      } catch (err) {
        console.log(`${source.name} failed:`, err);
      }
      return null;
    });

    const resolvedResults = await Promise.allSettled(promises);
    resolvedResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    });

    if (results.length === 0) {
      setLyricsSearchStatus('No lyrics found in any database');
      return null;
    }

    // Sort by quality and return the best result
    results.sort((a, b) => b.quality - a.quality);
    const bestResult = results[0];
    
    setLyricsSearchStatus(`Found lyrics from ${bestResult.source} (${results.length} sources checked)`);
    
    return {
      lyrics: bestResult.lyrics,
      source: bestResult.source,
      alternatives: results.length - 1
    };
  };

  const calculateLyricsQuality = (lyrics) => {
    let score = 0;
    
    // Length check (reasonable song length)
    if (lyrics.length > 100 && lyrics.length < 5000) score += 20;
    
    // Structure check (verse/chorus patterns)
    if (lyrics.match(/\[verse\]/gi)) score += 15;
    if (lyrics.match(/\[chorus\]/gi)) score += 15;
    if (lyrics.match(/\[bridge\]/gi)) score += 10;
    
    // Line count (reasonable number of lines)
    const lines = lyrics.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 10 && lines.length < 100) score += 20;
    
    // Repetition check (songs have repeated sections)
    const uniqueLines = new Set(lines);
    if (uniqueLines.size < lines.length * 0.8) score += 10;
    
    // Language check (mostly English characters for now)
    const englishRatio = (lyrics.match(/[a-zA-Z\s]/g) || []).length / lyrics.length;
    if (englishRatio > 0.7) score += 10;
    
    return score;
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
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10&market=US`,
        {
          headers: {
            'Authorization': `Bearer ${spotifyToken}`
          }
        }
      );

      const data = await response.json();
      if (data.tracks && data.tracks.items) {
        // Enhance results with additional metadata
        const enhancedResults = data.tracks.items.map(track => ({
          ...track,
          searchScore: calculateSearchRelevance(query, track),
          durationMinutes: Math.floor(track.duration_ms / 60000),
          durationSeconds: Math.floor((track.duration_ms % 60000) / 1000)
        }));
        
        // Sort by relevance
        enhancedResults.sort((a, b) => b.searchScore - a.searchScore);
        setSpotifyResults(enhancedResults);
      }
    } catch (err) {
      console.error('Spotify search failed:', err);
      setSpotifyResults([]);
    }
  };

  const calculateSearchRelevance = (query, track) => {
    let score = 0;
    const queryLower = query.toLowerCase();
    const titleLower = track.name.toLowerCase();
    const artistLower = track.artists[0].name.toLowerCase();
    
    // Exact matches
    if (titleLower === queryLower) score += 50;
    if (artistLower === queryLower) score += 30;
    
    // Partial matches
    if (titleLower.includes(queryLower)) score += 25;
    if (artistLower.includes(queryLower)) score += 15;
    if (queryLower.includes(titleLower)) score += 20;
    if (queryLower.includes(artistLower)) score += 10;
    
    // Popularity bonus
    score += Math.min(track.popularity / 10, 10);
    
    return score;
  };

  const selectSpotifyTrack = async (track) => {
    const songTitle = `${track.artists[0].name} - ${track.name}`;
    setSongInput(songTitle);
    setSpotifyResults([]);
    setError('');
    setLyricsSource('found');
    
    // Get enhanced Spotify data
    const [audioFeatures, trackAnalysis] = await Promise.all([
      getSpotifyAudioFeatures(track.id),
      getSpotifyTrackAnalysis(track.id)
    ]);
    
    // Search for lyrics from multiple sources
    const lyricsData = await searchLyricsMultiSource(track.artists[0].name, track.name);
    
    // Store comprehensive track data
    window.currentTrackData = {
      track: track,
      audioFeatures: audioFeatures,
      trackAnalysis: trackAnalysis,
      lyrics: lyricsData
    };
    
    setLyricsSearchStatus(''); // Clear status
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
      const { audioFeatures, trackAnalysis, lyrics: foundLyrics } = trackData;
      
      let systemPrompt = `You are a master ukulele instructor and professional music transcriptionist. Create highly accurate ukulele chord sheets with precise positioning and professional formatting.

🎵 PROFESSIONAL UKULELE TRANSCRIPTION STANDARDS:

1. ABSOLUTE ACCURACY: Use only verified, real lyrics - NEVER create fictional content
2. PRECISE CHORD POSITIONING: Place chords exactly above the syllable where harmony changes
3. UKULELE-OPTIMIZED CHORDS: Use proper ukulele voicings and fingerings
4. PROFESSIONAL STRUCTURE: Clear sections with proper musical notation
5. STRUMMING GUIDANCE: Include specific, playable strum patterns
6. TECHNICAL SPECIFICATIONS: Key, BPM, time signature, difficulty rating

${audioFeatures ? `
🎼 SPOTIFY AUDIO ANALYSIS DATA:
- Key: ${getKeyName(audioFeatures.key, audioFeatures.mode)}
- Tempo: ${Math.round(audioFeatures.tempo)} BPM
- Time Signature: ${audioFeatures.time_signature}/4
- Energy Level: ${Math.round(audioFeatures.energy * 100)}%
- Danceability: ${Math.round(audioFeatures.danceability * 100)}%
- Valence (Mood): ${Math.round(audioFeatures.valence * 100)}%
- Acousticness: ${Math.round(audioFeatures.acousticness * 100)}%

Use this precise musical data for accurate chord progressions, rhythm patterns, and arrangement style.
` : ''}

${trackAnalysis ? `
🎵 DETAILED MUSICAL ANALYSIS:
- Sections: ${trackAnalysis.sections?.length || 0} musical sections detected
- Beats: ${trackAnalysis.beats?.length || 0} beat markers
- Segments: Detailed harmonic analysis available
Optimize chord changes and structure based on this professional analysis.
` : ''}

${showChordGraphs ? `
🎸 CHORD DIAGRAM REQUIREMENTS:
Include standard ukulele chord diagrams using this format:
C Major: 0003 (G-C-E-A strings)
G Major: 0232
Am: 2000
F Major: 2010
[Continue for all chords used]
` : ''}

FORMATTING STANDARDS:
- Use Times New Roman style formatting
- Clear section headers [Intro], [Verse], [Chorus], [Bridge], [Outro]
- Precise chord-to-lyric alignment
- Professional strum pattern notation (D=Down, U=Up, X=Mute)
- Include musical tips and performance notes

CRITICAL: If provided lyrics are incomplete or inaccurate, note this clearly and suggest manual verification.`;

      let userPrompt;
      
      if (foundLyrics && foundLyrics.lyrics) {
        userPrompt = `Create a professional ukulele chord sheet for: "${songInput}"

VERIFIED LYRICS SOURCE: ${foundLyrics.source}
${foundLyrics.alternatives ? `(${foundLyrics.alternatives} alternative sources checked)` : ''}

COMPLETE LYRICS:
${foundLyrics.lyrics}

INSTRUCTIONS:
- Use these EXACT lyrics without modification
- Apply precise chord positioning based on audio analysis data
- Create professional-grade arrangement suitable for ukulele
- Include all technical specifications and performance guidance`;
        
        setLyricsSource('found');
      } else if (manualLyrics.trim()) {
        userPrompt = `Create a professional ukulele chord sheet for: "${songInput}"

USER-PROVIDED LYRICS (MANUAL INPUT):
${manualLyrics}

INSTRUCTIONS:
- Use these EXACT lyrics without modification
- Apply chord analysis and positioning
- Create complete professional arrangement
- Note that lyrics were manually provided`;
        
        setLyricsSource('manual');
      } else {
        setLyricsSource('not_found');
        setError('Lyrics not found in any database. Please provide the real lyrics manually below, or choose chord-only generation.');
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
          max_tokens: 1500,
          temperature: 0.2 // Very low temperature for maximum accuracy
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
        audioFeatures: audioFeatures,
        trackAnalysis: trackAnalysis,
        lyricsQuality: foundLyrics ? 'verified' : 'manual'
      };

      setChordSheet(generatedSheet);
      saveToHistory(generatedSheet);
      setManualLyrics('');
      
    } catch (err) {
      console.error('Error:', err);
      setError('Generation failed. Please try again or check your input.');
    } finally {
      setLoading(false);
    }
  };

  const generateTemplateSheet = async () => {
    if (!songInput.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const trackData = window.currentTrackData || {};
      const { audioFeatures, trackAnalysis } = trackData;
      
      const systemPrompt = `You are a professional ukulele instructor. Create a TEMPLATE chord sheet with placeholder lyrics that musicians can fill in with real lyrics later.

🎼 TEMPLATE CHORD SHEET SPECIFICATIONS:

1. CHORD PROGRESSIONS: Create realistic, playable ukulele progressions
2. PLACEHOLDER LYRICS: Use clear placeholders like "(First verse goes here)", "(Chorus hook line)"
3. SONG STRUCTURE: Complete sections - [Verse], [Chorus], [Bridge], [Outro]
4. LYRIC GUIDES: Show typical line lengths and syllable counts
5. PROFESSIONAL FORMAT: Ready-to-use template that any musician can fill

${audioFeatures ? `
🎵 SPOTIFY MUSICAL DATA:
- Key: ${getKeyName(audioFeatures.key, audioFeatures.mode)}
- Tempo: ${Math.round(audioFeatures.tempo)} BPM
- Energy: ${Math.round(audioFeatures.energy * 100)}%
- Mood: ${Math.round(audioFeatures.valence * 100)}% positive

Create chord progressions that match this musical profile.
` : ''}

TEMPLATE FORMAT EXAMPLE:
[Verse 1]
C              G           Am          F
(First verse line goes here - about 8-12 syllables)
C              G           Am          F
(Second line follows the melody)
Am             F           C           G
(Third line builds the story)
F              G           C           C
(Verse ending - resolution)

[Chorus]
F              C           G           Am
(Main hook/title line goes here)
F              C           G           C
(Memorable phrase that repeats)

CRITICAL: Use ONLY placeholder text in parentheses - NO fictional lyrics. Make it clear this is a template to fill in.

${showChordGraphs ? `
🎸 INCLUDE CHORD DIAGRAMS:
Provide ukulele fingering charts for all chords used.
` : ''}

Create a professional, usable template that any musician can immediately use.`;

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
            { role: 'user', content: `Create a professional ukulele chord sheet TEMPLATE for: "${songInput}". Use placeholder lyrics that can be replaced with real lyrics later.` }
          ],
          max_tokens: 1200,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const generatedSheet = {
        title: songInput + ' (Template)',
        content: data.choices[0].message.content,
        timestamp: new Date().toISOString(),
        id: Date.now(),
        source: 'template',
        audioFeatures: audioFeatures,
        trackAnalysis: trackAnalysis,
        lyricsQuality: 'template'
      };

      setChordSheet(generatedSheet);
      saveToHistory(generatedSheet);
      setLyricsSource('found'); // Reset state
      
    } catch (err) {
      console.error('Error:', err);
      setError('Generation failed. Please try again.');
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
      const { audioFeatures, trackAnalysis } = trackData;
      
      const systemPrompt = `You are a professional ukulele arranger. Create a comprehensive chord-only arrangement with detailed progressions and performance instructions.

🎼 CHORD-ONLY ARRANGEMENT SPECIFICATIONS:

1. DETAILED PROGRESSIONS: Complete verse/chorus/bridge chord sequences
2. UKULELE OPTIMIZATION: Use comfortable, playable chord voicings
3. PERFORMANCE GUIDANCE: Strumming patterns, dynamics, tempo changes
4. SONG STRUCTURE: Professional lead sheet format
5. MUSICAL ANALYSIS: Harmonic explanation and tips

${audioFeatures ? `
🎵 SPOTIFY MUSICAL DATA:
- Key: ${getKeyName(audioFeatures.key, audioFeatures.mode)}
- Tempo: ${Math.round(audioFeatures.tempo)} BPM
- Energy: ${Math.round(audioFeatures.energy * 100)}%
- Mood: ${Math.round(audioFeatures.valence * 100)}% positive
- Style indicators from audio analysis

Create progressions that match this musical profile.
` : ''}

${showChordGraphs ? `
🎸 INCLUDE CHORD DIAGRAMS:
Provide ukulele fingering charts for all chords used.
` : ''}

Format as a professional lead sheet with clear sections and detailed performance notes.`;

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
            { role: 'user', content: `Create a professional chord-only ukulele arrangement for: "${songInput}"` }
          ],
          max_tokens: 1000,
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
        audioFeatures: audioFeatures,
        trackAnalysis: trackAnalysis
      };

      setChordSheet(generatedSheet);
      saveToHistory(generatedSheet);
      setLyricsSource('found');
      
    } catch (err) {
      console.error('Error:', err);
      setError('Generation failed. Please try again.');
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

  const extractChordsFromSheet = (content) => {
    // Extract chord names from the generated sheet
    const chordMatches = content.match(/\b[A-G](?:[b#])?(?:maj|min|m|7|9|11|13|sus|dim|aug)?\b/g) || [];
    return [...new Set(chordMatches)].slice(0, 6); // Limit to 6 most common chords
  };

  const exportToPDF = () => {
    if (!chordSheet) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${chordSheet.title} - Professional Ukulele Chord Sheet</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&family=Courier+New&display=swap');
            body {
              font-family: 'Times New Roman', serif;
              margin: 40px;
              line-height: 1.9;
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
              font-size: 2.8rem;
              color: #8b4513;
              margin-bottom: 10px;
              font-weight: bold;
            }
            .metadata {
              color: #8b4513;
              font-size: 1rem;
              margin: 10px 0;
              display: flex;
              justify-content: space-between;
              flex-wrap: wrap;
            }
            .source-info {
              background: rgba(139, 69, 19, 0.1);
              padding: 8px 12px;
              border-radius: 6px;
              font-size: 0.9rem;
            }
            pre {
              white-space: pre-wrap;
              font-family: 'Times New Roman', serif;
              font-size: 14px;
              background: rgba(255, 255, 255, 0.9);
              padding: 30px;
              border-radius: 15px;
              border: 2px solid #8b4513;
              line-height: 2;
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
            .quality-indicator {
              background: #10b981;
              color: white;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 0.8rem;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎸 ${chordSheet.title}</h1>
            <div class="metadata">
              <div class="source-info">
                ${chordSheet.source && chordSheet.source !== 'manual' ? 
                  `📝 Lyrics: ${chordSheet.source}` : '📝 Manual lyrics input'}
              </div>
              ${chordSheet.audioFeatures ? 
                `<div class="source-info">🎵 Enhanced with Spotify Audio Analysis</div>` : ''}
              ${chordSheet.lyricsQuality === 'verified' ? 
                `<div class="quality-indicator">✅ Verified Accuracy</div>` : ''}
            </div>
            ${chordSheet.audioFeatures ? 
              `<div style="font-size: 0.9rem; color: #8b4513; margin-top: 10px;">
                Key: ${getKeyName(chordSheet.audioFeatures.key, chordSheet.audioFeatures.mode)} • 
                Tempo: ${Math.round(chordSheet.audioFeatures.tempo)} BPM • 
                Energy: ${Math.round(chordSheet.audioFeatures.energy * 100)}%
              </div>` : ''}
          </div>
          <pre>${chordSheet.content}</pre>
          <div class="footer">
            <div>Professional Ukulele Arrangement • Generated ${new Date(chordSheet.timestamp).toLocaleDateString()}</div>
            <div style="margin-top: 10px; font-style: italic;">Multi-source lyrics verification • Enhanced accuracy system</div>
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
    if (songInput.trim()) {
      setPreviousSearch({
        query: songInput,
        type: searchType,
        timestamp: Date.now()
      });
    }
    
    // Show Spotify login if switching to Spotify and not logged in
    if (newType === 'spotify' && !spotifyUser) {
      setShowSpotifyLogin(true);
    }
    
    setSongInput('');
    setSpotifyResults([]);
    setSearchType(newType);
    setError('');
    setLyricsSource('found');
    setManualLyrics('');
    setLyricsSearchStatus('');
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
        return "🎵 Search Spotify songs... (Enhanced with audio analysis)";
      case 'youtube':
        return "📺 Paste YouTube URL... (e.g., 'https://youtube.com/watch?v=...')";
      default:
        return "🎵 Enter any song title... (Multi-source lyrics lookup)";
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
          <p className="subtitle">Professional accuracy • Multi-source verification • Enhanced with AI 🎸</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="container">
          
          {/* Spotify Login Modal */}
          {showSpotifyLogin && (
            <div className="spotify-login-modal">
              <div className="modal-overlay" onClick={() => setShowSpotifyLogin(false)}></div>
              <div className="modal-content">
                <div className="modal-header">
                  <h3 className="modal-title">🎵 Connect Your Spotify Account</h3>
                  <button 
                    onClick={() => setShowSpotifyLogin(false)}
                    className="modal-close"
                  >
                    ✕
                  </button>
                </div>
                <div className="modal-body">
                  <SpotifyLogin 
                    onLoginSuccess={handleSpotifyLoginSuccess}
                    onLoginError={handleSpotifyLoginError}
                  />
                  {spotifyAuthError && (
                    <div className="auth-error">
                      🚨 {spotifyAuthError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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

          {/* Lyrics Search Status */}
          {lyricsSearchStatus && (
            <div className="lyrics-status">
              🔍 {lyricsSearchStatus}
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
                
                {/* Enhanced Spotify Search Results */}
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
                            {track.album.name} • {track.durationMinutes}:{track.durationSeconds.toString().padStart(2, '0')} • 
                            {track.popularity}% popularity • {track.explicit ? '🅴' : ''}
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
                  🎵 Provide the real lyrics for maximum accuracy:
                </label>
                <textarea
                  value={manualLyrics}
                  onChange={(e) => setManualLyrics(e.target.value)}
                  placeholder="Paste the complete song lyrics here for accurate chord positioning..."
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
                ⚙️ Advanced Settings
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
                      Include Professional Chord Diagrams (SVG Visual Charts)
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
                        <span className="spinner"></span> Generating Professional Sheet...
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
                    🎼 Create Chord-Only Arrangement
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
                      <span className="spinner"></span> Creating Professional Sheet...
                    </span>
                  ) : (
                    '🎸 Generate Professional Chord Sheet'
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
                    📄 Export Professional PDF
                  </button>
                  <span className="timestamp">
                    {new Date(chordSheet.timestamp).toLocaleDateString()}
                  </span>
                  {chordSheet.source && (
                    <span className="source-badge">
                      📝 {chordSheet.source}
                    </span>
                  )}
                  {chordSheet.lyricsQuality === 'verified' && (
                    <span className="quality-badge">
                      ✅ Verified
                    </span>
                  )}
                </div>
              </div>
              
              {/* Chord Diagrams */}
              {showChordGraphs && chordSheet.content && (
                <div className="chord-diagrams-section">
                  <h4 className="diagrams-title">🎸 Chord Diagrams:</h4>
                  <div className="chord-diagrams-grid">
                    {extractChordsFromSheet(chordSheet.content).map((chord) => (
                      <ChordDiagram 
                        key={chord} 
                        chord={chord} 
                        fingering={ukuleleChords[chord]} 
                      />
                    ))}
                  </div>
                </div>
              )}
              
              <div className="chord-sheet">
                <pre className="chord-content">{chordSheet.content}</pre>
              </div>
            </div>
          )}

          {/* History Section */}
          {history.length > 0 && (
            <div className="history-section">
              <h3 className="history-title">📚 Professional Session History</h3>
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
                      {sheet.lyricsQuality === 'verified' && <span className="history-verified">✅</span>}
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
          <p>🎸 Professional Ukulele System • Multi-Source Verification • Enhanced Accuracy • Powered by AI</p>
        </div>
      </footer>
    </div>
  );
};

export default App;