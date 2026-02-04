/**
 * Chat Message Composer Component (Upgraded)
 * - @ mention UX: chips in composer (no raw @[type:id:display] visible)
 * - Mentions are clickable and can redirect (via onMentionOpen/buildMentionUrl/default)
 * - Keyboard nav for suggestions (↑/↓ Enter Esc)
 * - Match highlighting + grouped suggestions
 * - Attachments: drag/drop + paste-to-attach + previews
 * - Upload errors via snackbar (keeps pending files)
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Popper,
  ClickAwayListener,
  Chip,
  CircularProgress,
  Divider,
  Tooltip,
  LinearProgress,
  Snackbar,
  Alert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import SendIcon from '@mui/icons-material/Send';
import PersonIcon from '@mui/icons-material/Person';
import FolderIcon from '@mui/icons-material/Folder';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { getChatMentionables, uploadAttachments } from '../../apiClient';
import { debounce } from 'lodash';

// ------------------------- Helpers -------------------------

const MAX_FILE_MB = 10;
const MAX_FILES = 5;

// Internal mention token format (kept for backend compatibility)
const MENTION_RE = /@\[(user|project|task):(\d+):([^\]]+)\]/g;

function safeLower(s) {
  return (s || '').toString().toLowerCase();
}

function highlightMatch(text, query) {
  if (!query) return text;
  const t = text || '';
  const q = query.trim();
  if (!q) return t;

  const idx = safeLower(t).indexOf(safeLower(q));
  if (idx < 0) return t;

  const before = t.slice(0, idx);
  const mid = t.slice(idx, idx + q.length);
  const after = t.slice(idx + q.length);

  return (
    <>
      {before}
      <Box component="span" sx={{ fontWeight: 800, color: 'text.primary' }}>
        {mid}
      </Box>
      {after}
    </>
  );
}

function buildDefaultMentionUrl({ type, id, workspaceId }) {
  if (!workspaceId) return null;
  // Adjust to your routing if needed:
  if (type === 'task') return `/workspaces/${workspaceId}/tasks/${id}`;
  if (type === 'project') return `/workspaces/${workspaceId}/projects/${id}`;
  if (type === 'user') return `/workspaces/${workspaceId}/team/${id}`;
  return null;
}

function getTypeMeta(type) {
  switch (type) {
    case 'user':
      return { icon: <PersonIcon fontSize="small" />, color: '#2563eb' }; // blue
    case 'project':
      return { icon: <FolderIcon fontSize="small" />, color: '#7c3aed' }; // purple
    case 'task':
      return { icon: <AssignmentIcon fontSize="small" />, color: '#0ea5e9' }; // sky
    default:
      return { icon: <PersonIcon fontSize="small" />, color: '#2563eb' };
  }
}

function fileKindIcon(mime) {
  const type = mime || '';
  if (type.startsWith('image/')) return <ImageIcon fontSize="small" />;
  if (type === 'application/pdf') return <PictureAsPdfIcon fontSize="small" />;
  return <InsertDriveFileIcon fontSize="small" />;
}

function formatFileSize(bytes) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function isImageFile(file) {
  return (file?.type || '').startsWith('image/');
}

// ------------------------- Suggestion Row -------------------------

function MentionSuggestionRow({ item, query, selected, onClick }) {
  const meta = getTypeMeta(item.type);
  const color = meta.color;

  return (
    <ListItemButton
      onClick={onClick}
      selected={selected}
      sx={{
        py: 0.85,
        px: 1.25,
        position: 'relative',
        '&.Mui-selected': {
          backgroundColor: alpha(color, 0.10),
        },
        '&:hover': {
          backgroundColor: alpha(color, 0.06),
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 8,
          bottom: 8,
          width: 3,
          borderRadius: 999,
          backgroundColor: selected ? color : 'transparent',
          opacity: selected ? 1 : 0,
        },
      }}
    >
      <ListItemAvatar sx={{ minWidth: 44 }}>
        <Avatar
          sx={{
            width: 30,
            height: 30,
            bgcolor: alpha(color, 0.14),
            color,
            fontSize: '0.875rem',
            border: `1px solid ${alpha(color, 0.20)}`,
          }}
        >
          {meta.icon}
        </Avatar>
      </ListItemAvatar>

      <ListItemText
        primary={
          <Typography variant="body2" sx={{ fontWeight: 750 }}>
            {highlightMatch(item.display, query)}
          </Typography>
        }
        secondary={
          item.type === 'user' ? (
            <Typography variant="caption" color="text.secondary">
              @{item.username}
            </Typography>
          ) : item.type === 'task' && item.project ? (
            <Typography variant="caption" color="text.secondary">
              in {item.project}
            </Typography>
          ) : null
        }
      />

      <Chip
        label={item.type}
        size="small"
        sx={{
          height: 20,
          fontSize: '0.70rem',
          textTransform: 'capitalize',
          bgcolor: alpha(color, 0.10),
          color,
          border: `1px solid ${alpha(color, 0.14)}`,
        }}
      />
    </ListItemButton>
  );
}

// ------------------------- Main Component -------------------------

function ChatComposer({
  workspaceId,
  threadId,
  onSend,
  onTyping,
  disabled,

  // Optional: customize mention click behavior
  onMentionOpen, // ({ type, id, display, url }) => void
  buildMentionUrl, // ({ type, id, workspaceId, threadId }) => string

  // Optional: customize limits
  maxFiles = MAX_FILES,
  maxFileMB = MAX_FILE_MB,
}) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const [mentionSearch, setMentionSearch] = useState(null); // { query, startIndex }
  const [mentionSuggestions, setMentionSuggestions] = useState({ users: [], projects: [], tasks: [] });
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [mentionAnchor, setMentionAnchor] = useState(null);

  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

  const [pendingFiles, setPendingFiles] = useState([]); // [{ id, file, previewUrl? }]
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [dragActive, setDragActive] = useState(false);

  const [toast, setToast] = useState({ open: false, severity: 'info', message: '' });

  const inputRef = useRef(null); // textarea DOM
  const textFieldRef = useRef(null); // anchor positioning
  const fileInputRef = useRef(null);

  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // ---------- Toast ----------
  const showToast = (messageText, severity = 'info') => {
    setToast({ open: true, severity, message: messageText });
  };

  // ---------- Files ----------
  const addFiles = useCallback(
    (files) => {
      const arr = Array.from(files || []);
      if (arr.length === 0) return;

      const tooMany = Math.max(0, (pendingFiles?.length || 0) + arr.length - maxFiles);
      const remainingSlots = maxFiles - (pendingFiles?.length || 0);

      const valid = [];
      for (const f of arr) {
        if (f.size > maxFileMB * 1024 * 1024) {
          showToast(`"${f.name}" is too large. Max ${maxFileMB}MB.`, 'warning');
          continue;
        }
        valid.push(f);
      }

      if (remainingSlots <= 0) {
        showToast(`You can attach up to ${maxFiles} files.`, 'warning');
        return;
      }

      if (tooMany > 0) {
        showToast(`Only ${remainingSlots} attachment slots left.`, 'warning');
      }

      const take = valid.slice(0, remainingSlots).map((file) => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const previewUrl = isImageFile(file) ? URL.createObjectURL(file) : null;
        return { id, file, previewUrl };
      });

      setPendingFiles((prev) => [...prev, ...take]);
    },
    [pendingFiles?.length, maxFiles, maxFileMB]
  );

  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    addFiles(files);
    e.target.value = '';
  };

  const removePendingFile = (id) => {
    setPendingFiles((prev) => {
      const next = prev.filter((p) => p.id !== id);
      const removed = prev.find((p) => p.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled || uploadingFiles) return;
    const files = e.dataTransfer?.files;
    if (files && files.length) addFiles(files);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || uploadingFiles) return;
    setDragActive(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const onPaste = (e) => {
    if (disabled || uploadingFiles) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    const files = [];
    for (const it of items) {
      if (it.kind === 'file') {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      addFiles(files);
      showToast(`${files.length} file(s) added from clipboard.`, 'success');
    }
  };

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      pendingFiles.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Mentions: fetch + cache-safe ----------
  const fetchSuggestions = useMemo(() => {
    let seq = 0;

    const fn = debounce(async (query) => {
      if (!workspaceId || query == null) return;

      const localSeq = ++seq;
      setLoadingSuggestions(true);

      try {
        const response = await getChatMentionables(workspaceId, { q: query });

        // Ignore out-of-order responses
        if (localSeq !== seq) return;

        setMentionSuggestions(response.data || { users: [], projects: [], tasks: [] });
      } catch (err) {
        console.error('Failed to fetch mention suggestions:', err);
      } finally {
        if (localSeq === seq) setLoadingSuggestions(false);
      }
    }, 200);

    return fn;
  }, [workspaceId]);

  useEffect(() => {
    return () => {
      try {
        fetchSuggestions.cancel?.();
      } catch {}
    };
  }, [fetchSuggestions]);

  // Flatten suggestions for keyboard selection
  const grouped = useMemo(() => {
    const users = mentionSuggestions.users || [];
    const projects = mentionSuggestions.projects || [];
    const tasks = mentionSuggestions.tasks || [];

    return [
      { label: 'PEOPLE', items: users, type: 'user' },
      { label: 'PROJECTS', items: projects, type: 'project' },
      { label: 'TASKS', items: tasks, type: 'task' },
    ].filter((g) => g.items.length > 0);
  }, [mentionSuggestions]);

  const flatSuggestions = useMemo(() => {
    const out = [];
    grouped.forEach((g) => {
      g.items.forEach((item) => out.push(item));
    });
    return out;
  }, [grouped]);

  const showSuggestions = Boolean(mentionAnchor) && (flatSuggestions.length > 0 || loadingSuggestions);

  // Reset active selection when suggestion list changes/opens
  useEffect(() => {
    if (showSuggestions) setActiveSuggestionIndex(0);
  }, [showSuggestions, mentionSearch?.query]);

  // ---------- Input change ----------
  const handleInputChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart ?? value.length;

    setMessage(value);

    // Detect @ trigger near cursor
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([^\s@]*)$/);

    if (mentionMatch) {
      setMentionSearch({
        query: mentionMatch[1],
        startIndex: textBeforeCursor.length - mentionMatch[0].length,
      });
      setMentionAnchor(textFieldRef.current);
      fetchSuggestions(mentionMatch[1]);
    } else {
      setMentionSearch(null);
      setMentionAnchor(null);
    }

    // typing indicator
    if (onTyping) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTyping(true);
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        onTyping(false);
      }, 2000);
    }
  };

  // Insert mention token (hidden from user by overlay renderer)
  const insertMention = useCallback(
    (item) => {
      if (!mentionSearch) return;

      const before = message.substring(0, mentionSearch.startIndex);
      const after = message.substring(mentionSearch.startIndex + mentionSearch.query.length + 1);
      const mentionText = `@[${item.type}:${item.id}:${item.display}] `;

      const next = before + mentionText + after;
      setMessage(next);

      setMentionSearch(null);
      setMentionAnchor(null);

      // restore focus & cursor after inserted mention
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const newCursor = before.length + mentionText.length;
          inputRef.current.setSelectionRange(newCursor, newCursor);
        }
      }, 0);
    },
    [message, mentionSearch]
  );

  // Mention click (chip redirect)
  const openMention = (m) => {
    const payload = { ...m, workspaceId, threadId };
    const url =
      (typeof buildMentionUrl === 'function' ? buildMentionUrl(payload) : null) ||
      buildDefaultMentionUrl({ type: m.type, id: m.id, workspaceId });

    if (typeof onMentionOpen === 'function') {
      onMentionOpen({ ...m, url });
      return;
    }
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Key handling (prioritize mention selection)
  const handleKeyDown = (e) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIndex((i) => (flatSuggestions.length ? (i + 1) % flatSuggestions.length : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIndex((i) => (flatSuggestions.length ? (i - 1 + flatSuggestions.length) % flatSuggestions.length : 0));
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const chosen = flatSuggestions[activeSuggestionIndex];
        if (chosen) insertMention(chosen);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionSearch(null);
        setMentionAnchor(null);
        return;
      }
    }

    // normal send
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape' && mentionAnchor) {
      setMentionSearch(null);
      setMentionAnchor(null);
    }
  };

  // Parse message into display segments (text + mention tokens)
  const parsedSegments = useMemo(() => {
    const segments = [];
    let lastIdx = 0;
    const str = message || '';
    let match;

    // Reset regex state
    MENTION_RE.lastIndex = 0;

    while ((match = MENTION_RE.exec(str)) !== null) {
      const [full, type, idRaw, display] = match;
      const start = match.index;
      const end = start + full.length;

      if (start > lastIdx) {
        segments.push({ kind: 'text', text: str.slice(lastIdx, start) });
      }

      segments.push({
        kind: 'mention',
        type,
        id: Number(idRaw),
        display,
        raw: full,
      });

      lastIdx = end;
    }

    if (lastIdx < str.length) {
      segments.push({ kind: 'text', text: str.slice(lastIdx) });
    }

    return segments;
  }, [message]);

  // Send message
  const handleSend = async () => {
    if ((!message.trim() && pendingFiles.length === 0) || disabled || uploadingFiles) return;

    let attachmentIds = [];

    if (pendingFiles.length > 0) {
      setUploadingFiles(true);
      setUploadProgress(0);

      try {
        const formData = new FormData();
        pendingFiles.forEach((p) => formData.append('files', p.file));
        formData.append('entityType', 'chat_message');
        formData.append('entityId', 'pending');
        formData.append('workspaceId', workspaceId);

        const response = await uploadAttachments(formData, {
          onUploadProgress: (progressEvent) => {
            const total = progressEvent.total || 1;
            const progress = Math.round((progressEvent.loaded * 100) / total);
            setUploadProgress(progress);
          },
        });

        attachmentIds = (response?.data?.attachments || []).map((a) => a.id);
      } catch (err) {
        console.error('Failed to upload files:', err);
        showToast('Failed to upload files. Please retry.', 'error');
        setUploadingFiles(false);
        setUploadProgress(0);
        return; // keep pendingFiles so user can retry
      }

      setUploadingFiles(false);
      setUploadProgress(0);
    }

    onSend(message.trim(), attachmentIds);

    // reset
    setMessage('');
    pendingFiles.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
    setPendingFiles([]);
    setMentionSearch(null);
    setMentionAnchor(null);

    // typing indicator stop
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTyping?.(false);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  // cleanup typing timeout
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  return (
    <Box
      sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      {/* Drag overlay */}
      {dragActive && !disabled && !uploadingFiles && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            backgroundColor: alpha('#0f172a', 0.04),
            border: `2px dashed ${alpha('#0f766e', 0.35)}`,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <Paper
            elevation={0}
            sx={{
              px: 2,
              py: 1,
              borderRadius: 2,
              border: `1px solid ${alpha('#0f172a', 0.08)}`,
              backgroundColor: alpha('#ffffff', 0.92),
            }}
          >
            <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>Drop files to attach</Typography>
            <Typography variant="caption" sx={{ color: alpha('#0f172a', 0.60) }}>
              Up to {maxFiles} files, {maxFileMB}MB each
            </Typography>
          </Paper>
        </Box>
      )}

      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <Box sx={{ mb: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {pendingFiles.map((p) => {
            const file = p.file;
            const icon = fileKindIcon(file.type);
            const meta = isImageFile(file) && p.previewUrl;

            return (
              <Chip
                key={p.id}
                avatar={
                  meta ? (
                    <Avatar
                      variant="rounded"
                      src={p.previewUrl}
                      sx={{ width: 22, height: 22 }}
                      imgProps={{ alt: file.name }}
                    />
                  ) : (
                    <Avatar sx={{ width: 22, height: 22 }}>{icon}</Avatar>
                  )
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" noWrap sx={{ maxWidth: 140 }}>
                      {file.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ({formatFileSize(file.size)})
                    </Typography>
                  </Box>
                }
                onDelete={() => removePendingFile(p.id)}
                deleteIcon={<CloseIcon fontSize="small" />}
                variant="outlined"
                size="small"
                sx={{ maxWidth: 280 }}
              />
            );
          })}
        </Box>
      )}

      {/* Upload progress */}
      {uploadingFiles && (
        <Box sx={{ mb: 1 }}>
          <LinearProgress variant="determinate" value={uploadProgress} />
          <Typography variant="caption" color="text.secondary">
            Uploading files… {uploadProgress}%
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', position: 'relative' }}>
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          style={{ display: 'none' }}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        />

        {/* Attachment button */}
        <Tooltip title={`Attach files (max ${maxFiles} files, ${maxFileMB}MB each). Tip: paste or drag & drop`}>
          <span>
            <IconButton
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || pendingFiles.length >= maxFiles || uploadingFiles}
              sx={{ color: 'text.secondary' }}
            >
              <AttachFileIcon />
            </IconButton>
          </span>
        </Tooltip>

        {/* Input wrapper (overlay renderer) */}
        <Box sx={{ flex: 1, position: 'relative' }}>
          {/* Overlay renderer (chips + text) */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              px: 2,
              py: 1.35,
              borderRadius: 3,
              pointerEvents: 'none', // allow clicks to fall through to textarea
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflow: 'hidden',
              color: 'text.primary',
              display: 'block',
            }}
          >
            {(!message || message.length === 0) && !isFocused ? (
              <Typography sx={{ color: alpha('#0f172a', 0.45), fontSize: '0.95rem' }}>
                Type a message… Use @ to mention
              </Typography>
            ) : (
              parsedSegments.map((seg, idx) => {
                if (seg.kind === 'text') {
                  return <React.Fragment key={`t-${idx}`}>{seg.text}</React.Fragment>;
                }
                const meta = getTypeMeta(seg.type);
                const color = meta.color;

                return (
                  <Box
                    key={`m-${idx}`}
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      mx: 0.2,
                      my: 0.15,
                      pointerEvents: 'auto', // clickable
                    }}
                  >
                    <Tooltip title={`Open ${seg.type}`} arrow>
                      <Chip
                        icon={meta.icon}
                        label={`@${seg.display}`}
                        onClick={() => openMention({ type: seg.type, id: seg.id, display: seg.display })}
                        deleteIcon={<OpenInNewIcon />}
                        onDelete={() => openMention({ type: seg.type, id: seg.id, display: seg.display })}
                        sx={{
                          height: 26,
                          fontSize: '0.86rem',
                          fontWeight: 750,
                          borderRadius: 999,
                          color,
                          bgcolor: alpha(color, 0.10),
                          border: `1px solid ${alpha(color, 0.18)}`,
                          '& .MuiChip-icon': { color },
                          '& .MuiChip-deleteIcon': { color: alpha(color, 0.70) },
                          '&:hover': { bgcolor: alpha(color, 0.14) },
                        }}
                        variant="filled"
                        size="small"
                      />
                    </Tooltip>
                  </Box>
                );
              })
            )}
          </Box>

          {/* Actual TextField (text transparent, caret visible) */}
          <TextField
            ref={textFieldRef}
            inputRef={inputRef}
            fullWidth
            multiline
            maxRows={4}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onPaste={onPaste}
            disabled={disabled || uploadingFiles}
            placeholder="" // handled by overlay
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                backgroundColor: 'grey.50',
              },
              '& .MuiOutlinedInput-inputMultiline': {
                // Hide raw token text but keep caret visible
                color: 'transparent',
                caretColor: '#0f172a',
                // Ensure selection still shows (background highlight)
                WebkitTextFillColor: 'transparent',
              },
            }}
          />
        </Box>

        {/* Send */}
        <Tooltip title={showSuggestions ? 'Select a mention or press Esc' : 'Send (Enter)'}>
          <span>
            <IconButton
              color="primary"
              onClick={handleSend}
              disabled={(!message.trim() && pendingFiles.length === 0) || disabled || uploadingFiles}
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                '&:hover': { bgcolor: 'primary.dark' },
                '&:disabled': { bgcolor: 'grey.300', color: 'grey.500' },
              }}
            >
              <SendIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Mention suggestions popover */}
      <Popper
        open={showSuggestions}
        anchorEl={mentionAnchor}
        placement="top-start"
        style={{ zIndex: 1300 }}
        modifiers={[
          { name: 'offset', options: { offset: [0, 10] } },
          { name: 'preventOverflow', options: { padding: 8 } },
        ]}
      >
        <ClickAwayListener
          onClickAway={() => {
            setMentionSearch(null);
            setMentionAnchor(null);
          }}
        >
          <Paper
            elevation={10}
            sx={{
              maxHeight: 320,
              overflow: 'auto',
              minWidth: 320,
              mb: 1,
              borderRadius: 2,
              border: `1px solid ${alpha('#0f172a', 0.08)}`,
              boxShadow: `0 18px 50px ${alpha('#0f172a', 0.18)}`,
            }}
          >
            {/* Header */}
            <Box sx={{ px: 1.25, py: 1, borderBottom: `1px solid ${alpha('#0f172a', 0.06)}` }}>
              <Typography sx={{ fontWeight: 850, fontSize: '0.9rem' }}>
                Mention
                {mentionSearch?.query ? (
                  <Box component="span" sx={{ color: 'text.secondary', fontWeight: 650 }}>
                    {' '}
                    — “{mentionSearch.query}”
                  </Box>
                ) : null}
              </Typography>
              <Typography variant="caption" sx={{ color: alpha('#0f172a', 0.55) }}>
                Use ↑ ↓ and Enter to select
              </Typography>
            </Box>

            {loadingSuggestions ? (
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={24} />
              </Box>
            ) : flatSuggestions.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No matches found
                </Typography>
              </Box>
            ) : (
              <List dense disablePadding>
                {(() => {
                  // render grouped with correct "selected" mapping
                  let globalIndex = 0;
                  return grouped.map((g, gi) => (
                    <Box key={`g-${gi}`}>
                      {gi > 0 && <Divider />}
                      <ListItem sx={{ py: 0.6, px: 1.25, bgcolor: 'grey.50' }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ letterSpacing: 0.8 }}>
                          {g.label}
                        </Typography>
                      </ListItem>

                      {g.items.map((item) => {
                        const idx = globalIndex;
                        globalIndex += 1;
                        return (
                          <MentionSuggestionRow
                            key={`${item.type}-${item.id}`}
                            item={item}
                            query={mentionSearch?.query || ''}
                            selected={idx === activeSuggestionIndex}
                            onClick={() => insertMention(item)}
                          />
                        );
                      })}
                    </Box>
                  ));
                })()}
              </List>
            )}
          </Paper>
        </ClickAwayListener>
      </Popper>

      {/* Hint */}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.7, display: 'block' }}>
        Enter to send, Shift+Enter for new line • @ mentions become clickable chips • Paste / drag files to attach
      </Typography>

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3200}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          severity={toast.severity}
          sx={{ borderRadius: 2 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ChatComposer;
