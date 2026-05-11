interface SheetInfo {
  name?: string;
  usedRange?: string;
  rowCount?: number;
  colCount?: number;
  detectedSections?: string[];
  detectedTables?: Array<{
    range?: string;
    plantPart?: string;
    variety?: string;
    treatments?: string[];
    sectionHeader?: string;
  }>;
}

interface Props {
  profile: Record<string, unknown>;
  observationCount: number;
}

export default function WorkbookProfileView({ profile, observationCount }: Props) {
  const sheets = (profile['sheets'] ?? []) as SheetInfo[];
  const totalTables = (profile['totalTables'] ?? 0) as number;
  const candidateMetrics = (profile['candidateMetrics'] ?? []) as string[];
  const warnings = (profile['warnings'] ?? []) as string[];
  const fileName = (profile['fileName'] ?? '') as string;

  return (
    <div>
      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Sheets', value: sheets.length, icon: '📋' },
          { label: 'Tables', value: totalTables, icon: '📐' },
          { label: 'Observations', value: observationCount, icon: '🔬' },
          { label: 'Metrics', value: candidateMetrics.length, icon: '📏' },
        ].map(s => (
          <div key={s.label} style={{
            backgroundColor: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: 6,
            padding: '12px 16px',
            minWidth: 100,
          }}>
            <div style={{ fontSize: 12, color: '#8b949e' }}>{s.icon} {s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: '#e6edf3' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {fileName && (
        <p style={{ fontSize: 13, color: '#8b949e', margin: '0 0 16px' }}>
          Source: {fileName}
        </p>
      )}

      {/* Sheet list */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 16 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #30363d' }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: '#8b949e', fontWeight: 600 }}>Sheet</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: '#8b949e', fontWeight: 600 }}>Range</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', color: '#8b949e', fontWeight: 600 }}>Rows</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', color: '#8b949e', fontWeight: 600 }}>Sections</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', color: '#8b949e', fontWeight: 600 }}>Tables</th>
          </tr>
        </thead>
        <tbody>
          {sheets.map(s => (
            <tr key={s.name} style={{ borderBottom: '1px solid #21262d' }}>
              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{s.name}</td>
              <td style={{ padding: '8px 12px', color: '#8b949e', fontFamily: 'monospace', fontSize: 12 }}>
                {s.usedRange || '—'}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{s.rowCount ?? 0}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{s.detectedSections?.length ?? 0}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{s.detectedTables?.length ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Detected tables detail */}
      {sheets.some(s => (s.detectedTables?.length ?? 0) > 0) && (
        <div>
          <h3 style={{ fontSize: 15, margin: '0 0 8px', color: '#e6edf3' }}>Detected Table Blocks</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sheets.flatMap(s =>
              (s.detectedTables ?? []).map((t, i) => (
                <div key={`${s.name}-${i}`} style={{
                  backgroundColor: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 13,
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}>
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                  <span style={{ fontFamily: 'monospace', color: '#8b949e' }}>{t.range}</span>
                  {t.sectionHeader && (
                    <span style={{
                      backgroundColor: '#1f6feb33',
                      color: '#58a6ff',
                      padding: '1px 6px',
                      borderRadius: 4,
                      fontSize: 11,
                    }}>
                      {t.sectionHeader}
                    </span>
                  )}
                  {t.plantPart && (
                    <span style={{
                      backgroundColor: '#23863633',
                      color: '#3fb950',
                      padding: '1px 6px',
                      borderRadius: 4,
                      fontSize: 11,
                    }}>
                      {t.plantPart}
                    </span>
                  )}
                  {t.variety && (
                    <span style={{
                      backgroundColor: '#bc8cff33',
                      color: '#bc8cff',
                      padding: '1px 6px',
                      borderRadius: 4,
                      fontSize: 11,
                    }}>
                      {t.variety}
                    </span>
                  )}
                  {(t.treatments?.length ?? 0) > 0 && (
                    <span style={{ color: '#8b949e', fontSize: 11 }}>
                      {t.treatments!.join(' · ')}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Candidate metrics */}
      {candidateMetrics.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 15, margin: '0 0 8px', color: '#e6edf3' }}>Candidate Metrics</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {candidateMetrics.map(m => (
              <span key={m} style={{
                backgroundColor: '#21262d',
                border: '1px solid #30363d',
                borderRadius: 12,
                padding: '4px 10px',
                fontSize: 12,
                color: '#e6edf3',
              }}>
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {warnings.map((w, i) => (
            <p key={i} style={{ margin: '4px 0', fontSize: 13, color: '#d29922' }}>⚠️ {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}
