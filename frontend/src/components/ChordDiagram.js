import React from 'react';

const ChordDiagram = ({ chord, fingering }) => {
  if (!fingering) return null;

  // Ukulele fret positions (4 strings: G C E A from top to bottom)
  const frets = fingering.split('').map(f => parseInt(f) || 0);
  
  return (
    <div className="chord-diagram">
      <div className="chord-name">{chord}</div>
      <svg width="60" height="80" viewBox="0 0 60 80" className="fretboard">
        {/* Fret lines */}
        {[0, 1, 2, 3, 4].map(fret => (
          <line 
            key={fret}
            x1="10" 
            y1={15 + fret * 12} 
            x2="50" 
            y2={15 + fret * 12}
            stroke="#8b4513" 
            strokeWidth={fret === 0 ? "3" : "1"}
          />
        ))}
        
        {/* String lines */}
        {[0, 1, 2, 3].map(string => (
          <line 
            key={string}
            x1={15 + string * 10} 
            y1="15" 
            x2={15 + string * 10} 
            y2="63"
            stroke="#d4a574" 
            strokeWidth="2"
          />
        ))}
        
        {/* Finger positions */}
        {frets.map((fret, string) => {
          if (fret === 0) {
            // Open string
            return (
              <circle
                key={string}
                cx={15 + string * 10}
                cy="10"
                r="3"
                fill="none"
                stroke="#8b4513"
                strokeWidth="2"
              />
            );
          } else {
            // Fretted position
            return (
              <circle
                key={string}
                cx={15 + string * 10}
                cy={15 + (fret - 0.5) * 12}
                r="4"
                fill="#8b4513"
              />
            );
          }
        })}
        
        {/* String labels */}
        <text x="15" y="75" fontSize="8" textAnchor="middle" fill="#8b4513">G</text>
        <text x="25" y="75" fontSize="8" textAnchor="middle" fill="#8b4513">C</text>
        <text x="35" y="75" fontSize="8" textAnchor="middle" fill="#8b4513">E</text>
        <text x="45" y="75" fontSize="8" textAnchor="middle" fill="#8b4513">A</text>
      </svg>
    </div>
  );
};

export default ChordDiagram;