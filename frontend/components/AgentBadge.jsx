// src/components/AgentBadge.jsx
// Small pill that shows which agent handled a message and which LLM was used

const AGENT_STYLES = {
  voice:   { bg: '#e0f2fe', color: '#0369a1', icon: '📞', label: 'Voice' },
  support: { bg: '#fef3c7', color: '#92400e', icon: '🎧', label: 'Support' },
  news:    { bg: '#f0fdf4', color: '#15803d', icon: '📰', label: 'News' },
  chat:    { bg: '#f3f4f6', color: '#374151', icon: '💬', label: 'Chat' },
};

const PROVIDER_COLORS = {
  claude: '#d97706',
  gemini: '#1d4ed8',
  openai: '#059669',
};

export function AgentBadge({ agent, provider, fallback }) {
  const style = AGENT_STYLES[agent] ?? AGENT_STYLES.chat;

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
      <span style={{
        background:   style.bg,
        color:        style.color,
        fontSize:     '11px',
        fontWeight:   600,
        padding:      '2px 8px',
        borderRadius: '99px',
        letterSpacing: '0.02em',
      }}>
        {style.icon} {style.label}
      </span>

      {provider && (
        <span style={{
          background:   '#f9fafb',
          color:        PROVIDER_COLORS[provider] ?? '#6b7280',
          fontSize:     '10px',
          fontWeight:   500,
          padding:      '2px 7px',
          borderRadius: '99px',
          border:       `1px solid ${PROVIDER_COLORS[provider] ?? '#e5e7eb'}`,
        }}>
          {provider}{fallback ? ' (fallback)' : ''}
        </span>
      )}
    </div>
  );
}
