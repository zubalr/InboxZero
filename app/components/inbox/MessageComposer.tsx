'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

interface Thread {
  _id: Id<'threads'>;
  subject: string;
  messageId: string;
  participants: Array<{
    email: string;
    name?: string;
    type: 'to' | 'cc' | 'bcc' | 'from';
  }>;
  references: string[];
}

interface MessageComposerProps {
  threadId: Id<'threads'>;
  thread: Thread;
  onCancel: () => void;
  onSent: () => void;
  initialContent?: string;
}

interface Draft {
  threadId: Id<'threads'>;
  content: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  lastSaved: number;
}

export function MessageComposer({
  threadId,
  thread,
  onCancel,
  onSent,
  initialContent = '',
}: MessageComposerProps) {
  const [content, setContent] = useState(initialContent);
  const [customTo, setCustomTo] = useState<string[]>([]);
  const [customCc, setCustomCc] = useState<string[]>([]);
  const [customBcc, setCustomBcc] = useState<string[]>([]);
  const [customSubject, setCustomSubject] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showFormatting, setShowFormatting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const draftTimer = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendReply = useMutation(api["email-new"].sendReply);

  // Extract reply recipients from thread participants
  const fromParticipant = thread.participants.find((p) => p.type === 'from');
  const toParticipants = thread.participants.filter((p) => p.type === 'to');
  const ccParticipants = thread.participants.filter((p) => p.type === 'cc');

  // Set up reply-to logic
  const defaultTo = fromParticipant ? [fromParticipant.email] : [];
  const replySubject = thread.subject.startsWith('Re:')
    ? thread.subject
    : `Re: ${thread.subject}`;

  const finalTo = customTo.length > 0 ? customTo : defaultTo;
  const finalSubject = customSubject || replySubject;

  // Auto-save draft functionality
  const saveDraft = useCallback(async () => {
    if (!content.trim() && !customTo.length && !customSubject) return;

    setIsDraftSaving(true);
    try {
      const draft: Draft = {
        threadId,
        content,
        to: finalTo,
        cc: showCc ? customCc : undefined,
        bcc: showBcc ? customBcc : undefined,
        subject: finalSubject,
        lastSaved: Date.now(),
      };

      // Save to localStorage for now - in production, save to database
      localStorage.setItem(`draft-${threadId}`, JSON.stringify(draft));
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save draft:', error);
    } finally {
      setIsDraftSaving(false);
    }
  }, [
    content,
    customTo,
    customCc,
    customBcc,
    customSubject,
    threadId,
    finalTo,
    finalSubject,
    showCc,
    showBcc,
  ]);

  // Load existing draft on mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(`draft-${threadId}`);
      if (savedDraft) {
        const draft: Draft = JSON.parse(savedDraft);
        setContent(draft.content);
        setCustomTo(draft.to);
        setCustomCc(draft.cc || []);
        setCustomBcc(draft.bcc || []);
        setCustomSubject(draft.subject !== replySubject ? draft.subject : '');
        setLastSaved(new Date(draft.lastSaved));
        if (draft.cc?.length) setShowCc(true);
        if (draft.bcc?.length) setShowBcc(true);
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
    }
  }, [threadId, replySubject]);

  // Auto-save when content changes
  useEffect(() => {
    if (isEditing) {
      if (draftTimer.current) {
        clearTimeout(draftTimer.current);
      }
      draftTimer.current = setTimeout(saveDraft, 2000); // Save after 2 seconds of inactivity
    }
    return () => {
      if (draftTimer.current) {
        clearTimeout(draftTimer.current);
      }
    };
  }, [
    content,
    customTo,
    customCc,
    customBcc,
    customSubject,
    isEditing,
    saveDraft,
  ]);

  const handleSend = async () => {
    if (!content.trim()) return;

    setIsSending(true);
    try {
      await sendReply({
        threadId,
        to: finalTo,
        cc: showCc && customCc.length > 0 ? customCc : undefined,
        bcc: showBcc && customBcc.length > 0 ? customBcc : undefined,
        subject: finalSubject,
        textContent: content,
        htmlContent: convertToHtml(content),
        inReplyTo: thread.messageId,
        references: [...thread.references, thread.messageId],
      });

      // Clear draft after successful send
      localStorage.removeItem(`draft-${threadId}`);
      setContent('');
      setCustomTo([]);
      setCustomCc([]);
      setCustomBcc([]);
      setCustomSubject('');
      onSent();
    } catch (error) {
      console.error('Failed to send reply:', error);
      alert('Failed to send reply. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleCancel = () => {
    // Ask user if they want to save draft before canceling
    if (content.trim() && !window.confirm('Discard unsaved changes?')) {
      return;
    }

    // Clear draft if user confirms discard
    if (content.trim()) {
      localStorage.removeItem(`draft-${threadId}`);
    }

    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setIsEditing(true);
  };

  const insertFormatting = (type: 'bold' | 'italic' | 'link') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    let replacement = '';
    switch (type) {
      case 'bold':
        replacement = `**${selectedText || 'bold text'}**`;
        break;
      case 'italic':
        replacement = `*${selectedText || 'italic text'}*`;
        break;
      case 'link':
        replacement = `[${selectedText || 'link text'}](url)`;
        break;
    }

    const newContent =
      content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    // Focus and set cursor position after formatting
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + replacement.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const convertToHtml = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\n/g, '<br>');
  };

  const addRecipient = (type: 'to' | 'cc' | 'bcc', email: string) => {
    if (!email.trim()) return;

    const setter =
      type === 'to' ? setCustomTo : type === 'cc' ? setCustomCc : setCustomBcc;
    const current =
      type === 'to' ? customTo : type === 'cc' ? customCc : customBcc;

    if (!current.includes(email)) {
      setter([...current, email]);
    }
  };

  const removeRecipient = (type: 'to' | 'cc' | 'bcc', email: string) => {
    const setter =
      type === 'to' ? setCustomTo : type === 'cc' ? setCustomCc : setCustomBcc;
    const current =
      type === 'to' ? customTo : type === 'cc' ? customCc : customBcc;

    setter(current.filter((e) => e !== email));
  };

  return (
    <div className="border-t border-gray-200 bg-white">
      {/* Compact view */}
      {!isExpanded ? (
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">
              Reply to: {fromParticipant?.name || fromParticipant?.email}
              {lastSaved && (
                <span className="ml-2 text-xs text-green-600">
                  Draft saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {isDraftSaving && (
                <div className="text-xs text-gray-500 flex items-center">
                  <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-400 mr-1"></div>
                  Saving...
                </div>
              )}
              <button
                onClick={() => setIsExpanded(true)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Expand
              </button>
            </div>
          </div>

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your reply... (⌘+Enter to send)"
              className="w-full h-24 p-3 border border-gray-300 rounded-md resize-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />

            {/* Formatting toolbar for compact view */}
            {content && (
              <div className="absolute bottom-2 right-2 flex items-center space-x-1 bg-white border border-gray-200 rounded px-2 py-1 shadow-sm">
                <button
                  onClick={() => insertFormatting('bold')}
                  className="p-1 text-xs text-gray-600 hover:text-gray-800"
                  title="Bold"
                >
                  <strong>B</strong>
                </button>
                <button
                  onClick={() => insertFormatting('italic')}
                  className="p-1 text-xs text-gray-600 hover:text-gray-800 italic"
                  title="Italic"
                >
                  I
                </button>
                <button
                  onClick={() => insertFormatting('link')}
                  className="p-1 text-xs text-gray-600 hover:text-gray-800"
                  title="Link"
                >
                  🔗
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-gray-500">⌘+Enter to send</div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!content.trim() || isSending}
                className="px-4 py-2 text-sm text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isSending && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Enhanced Expanded view */
        <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-medium text-gray-900">
                Compose Reply
              </h3>
              {lastSaved && (
                <span className="text-xs text-green-600 flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
              {isDraftSaving && (
                <span className="text-xs text-gray-500 flex items-center">
                  <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-400 mr-1"></div>
                  Saving draft...
                </span>
              )}
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Collapse
            </button>
          </div>

          {/* Enhanced Recipients */}
          <div className="space-y-3">
            <div className="flex items-start">
              <label className="w-12 text-sm font-medium text-gray-700 mt-2">
                To:
              </label>
              <div className="flex-1">
                <div className="flex flex-wrap gap-1 mb-2">
                  {finalTo.map((email, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
                    >
                      {email}
                      {customTo.includes(email) && (
                        <button
                          onClick={() => removeRecipient('to', email)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                <input
                  type="email"
                  placeholder="Add recipient..."
                  className="w-full text-sm border-b border-gray-200 focus:border-blue-500 focus:outline-none py-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addRecipient('to', e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
              </div>
            </div>

            {showCc && (
              <div className="flex items-start">
                <label className="w-12 text-sm font-medium text-gray-700 mt-2">
                  CC:
                </label>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {customCc.map((email, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-md text-sm"
                      >
                        {email}
                        <button
                          onClick={() => removeRecipient('cc', email)}
                          className="ml-1 text-green-600 hover:text-green-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="email"
                    placeholder="Add CC recipient..."
                    className="w-full text-sm border-b border-gray-200 focus:border-blue-500 focus:outline-none py-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addRecipient('cc', e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {showBcc && (
              <div className="flex items-start">
                <label className="w-12 text-sm font-medium text-gray-700 mt-2">
                  BCC:
                </label>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-1 mb-2">
                    {customBcc.map((email, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded-md text-sm"
                      >
                        {email}
                        <button
                          onClick={() => removeRecipient('bcc', email)}
                          className="ml-1 text-purple-600 hover:text-purple-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="email"
                    placeholder="Add BCC recipient..."
                    className="w-full text-sm border-b border-gray-200 focus:border-blue-500 focus:outline-none py-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addRecipient('bcc', e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center space-x-4 text-sm">
              <button
                onClick={() => setShowCc(!showCc)}
                className="text-blue-600 hover:text-blue-800"
              >
                {showCc ? 'Hide CC' : 'Add CC'}
              </button>
              <button
                onClick={() => setShowBcc(!showBcc)}
                className="text-blue-600 hover:text-blue-800"
              >
                {showBcc ? 'Hide BCC' : 'Add BCC'}
              </button>
            </div>
          </div>

          {/* Enhanced Subject */}
          <div className="flex items-center">
            <label className="w-12 text-sm font-medium text-gray-700">
              Subject:
            </label>
            <input
              type="text"
              value={customSubject || replySubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              className="flex-1 text-sm border-b border-gray-200 focus:border-blue-500 focus:outline-none py-2"
            />
          </div>

          {/* Enhanced Content with formatting */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => insertFormatting('bold')}
                  className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  title="Bold (Ctrl+B)"
                >
                  <strong>B</strong>
                </button>
                <button
                  onClick={() => insertFormatting('italic')}
                  className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 italic"
                  title="Italic (Ctrl+I)"
                >
                  I
                </button>
                <button
                  onClick={() => insertFormatting('link')}
                  className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  title="Add Link"
                >
                  🔗
                </button>
              </div>
              <div className="text-xs text-gray-500">
                Markdown supported: **bold**, *italic*, [link](url)
              </div>
            </div>

            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your reply..."
              className="w-full h-40 p-3 border border-gray-300 rounded-md resize-y focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Enhanced Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-4">
              <div className="text-xs text-gray-500">⌘+Enter to send</div>
              {content.length > 0 && (
                <div className="text-xs text-gray-500">
                  {content.length} characters
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={saveDraft}
                disabled={isDraftSaving}
                className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                {isDraftSaving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!content.trim() || isSending}
                className="px-4 py-2 text-sm text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isSending && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {isSending ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
