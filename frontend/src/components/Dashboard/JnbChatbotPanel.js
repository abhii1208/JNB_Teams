import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SendIcon from '@mui/icons-material/Send';
import { askWorkspaceAssistant } from '../../apiClient';

const buildWelcomeMessage = (workspaceName) => ({
  id: `assistant-${Date.now()}`,
  role: 'assistant',
  content: `Hi, I'm JNB chatbot. Ask me about tasks, deadlines, project status, team summaries, latest finance news, or a daily workspace update for ${workspaceName || 'your workspace'}.`,
});

function JnbChatbotPanel({ workspace, user, floating = false }) {
  const [messages, setMessages] = React.useState(() => [buildWelcomeMessage(workspace?.name)]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [errorText, setErrorText] = React.useState('');
  const [suggestions, setSuggestions] = React.useState([
    'Show latest finance news',
    'Daily workspace update',
    'Summarize our tasks',
    'What deadlines are at risk?',
    'Draft a team update',
  ]);

  React.useEffect(() => {
    setMessages([buildWelcomeMessage(workspace?.name)]);
  }, [workspace?.id, workspace?.name]);

  const handleSend = async (value = input) => {
    const message = String(value || '').trim();
    if (!workspace?.id || !message || loading) return;
    setErrorText('');

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const history = nextMessages.slice(-8).map((item) => ({
        role: item.role,
        content: item.content,
      }));

      const response = await askWorkspaceAssistant(workspace.id, {
        message,
        history,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.data?.reply || 'I could not generate a response right now.',
        },
      ]);

      if (Array.isArray(response.data?.suggestions) && response.data.suggestions.length > 0) {
        setSuggestions(response.data.suggestions);
      }
    } catch (error) {
      console.error('JNB chatbot failed:', error);
      setErrorText(error?.response?.data?.error || error?.message || 'Assistant request failed');
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: 'I could not respond right now. Please try again in a moment.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        mb: floating ? 0 : 3,
        p: { xs: 2, md: 2.25 },
        maxWidth: floating ? '100%' : 920,
        mx: floating ? 0 : 'auto',
        border: '1px solid rgba(148, 163, 184, 0.15)',
        borderRadius: 3,
        background: 'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(240,249,255,0.92) 100%)',
        boxShadow: floating ? '0 20px 45px rgba(15, 23, 42, 0.16)' : 'none',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: '#0f766e', width: 42, height: 42 }}>
            <SmartToyIcon sx={{ fontSize: 22 }} />
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
              JNB chatbot
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Ask about tasks, deadlines, summaries, finance news, or a daily workspace update.
            </Typography>
          </Box>
        </Box>

        <Chip
          size="small"
          icon={<AutoAwesomeIcon sx={{ fontSize: '1rem !important' }} />}
          label="Ask AI"
          sx={{
            bgcolor: 'rgba(15,118,110,0.10)',
            color: '#0f766e',
            fontWeight: 700,
          }}
        />
      </Box>

      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mb: 1.75 }}>
        {suggestions.map((suggestion) => (
          <Chip
            key={suggestion}
            size="small"
            label={suggestion}
            onClick={() => handleSend(suggestion)}
            clickable
            sx={{
              borderRadius: 999,
              bgcolor: '#ffffff',
              border: '1px solid rgba(15,118,110,0.14)',
              '&:hover': {
                bgcolor: 'rgba(15,118,110,0.06)',
              },
            }}
          />
        ))}
      </Stack>

      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: '1px solid rgba(148, 163, 184, 0.14)',
          backgroundColor: '#ffffff',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            maxHeight: 240,
            minHeight: 160,
            overflowY: 'auto',
            p: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
            background: 'linear-gradient(180deg, rgba(248,250,252,0.75) 0%, rgba(255,255,255,1) 100%)',
          }}
        >
          {messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <Box
                sx={{
                  maxWidth: { xs: '100%', md: '72%' },
                  px: 1.5,
                  py: 1,
                  borderRadius: 3,
                  bgcolor: message.role === 'user' ? '#0f766e' : '#f8fafc',
                  color: message.role === 'user' ? '#ffffff' : '#0f172a',
                  boxShadow: message.role === 'user'
                    ? '0 10px 18px rgba(15,118,110,0.18)'
                    : '0 8px 18px rgba(15,23,42,0.05)',
                  border: message.role === 'assistant' ? '1px solid rgba(148,163,184,0.14)' : 'none',
                }}
              >
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, mb: 0.35, opacity: 0.8 }}>
                  {message.role === 'user'
                    ? `${user?.first_name || user?.username || 'You'}`
                    : 'JNB chatbot'}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {message.content}
                </Typography>
              </Box>
            </Box>
          ))}

          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
              <CircularProgress size={18} />
              <Typography variant="body2">JNB chatbot is thinking...</Typography>
            </Box>
          )}
        </Box>

        <Divider />

        <Box sx={{ p: 1.5, display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            minRows={1}
            maxRows={3}
            size="small"
            placeholder="Ask JNB chatbot about tasks, deadlines, finance news, or a daily workspace update..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
          />
          <IconButton
            onClick={() => handleSend()}
            disabled={!workspace?.id || !input.trim() || loading}
            sx={{
              width: 44,
              height: 44,
              bgcolor: '#0f766e',
              color: '#ffffff',
              '&:hover': { bgcolor: '#115e59' },
              '&.Mui-disabled': {
                bgcolor: '#cbd5e1',
                color: '#64748b',
              },
            }}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>

      <Box sx={{ mt: 1.25, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="caption" color={errorText ? 'error.main' : 'text.secondary'}>
          {errorText || 'Ask for summaries, finance headlines, daily workspace updates, deadline risks, or quick team updates.'}
        </Typography>
        <Button
          size="small"
          variant="text"
          onClick={() => handleSend('Daily workspace update')}
          disabled={!workspace?.id || loading}
        >
          Daily workspace update
        </Button>
      </Box>
    </Paper>
  );
}

export default JnbChatbotPanel;
