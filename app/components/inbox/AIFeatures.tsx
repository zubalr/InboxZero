'use client';

import { useState, useEffect } from 'react';
import { useAction, useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

interface AISummaryProps {
  threadId: Id<'threads'>;
}

export function AISummary({ threadId }: AISummaryProps) {
  const [summary, setSummary] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionItems, setActionItems] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);
  const [userFeedback, setUserFeedback] = useState<
    'helpful' | 'not_helpful' | null
  >(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');

  const generateSummary = useAction(api.ai.generateSummary);
  const saveFeedback = useMutation(api.ai.saveSummaryFeedback);
  const thread = useQuery(api.threads.getThread, { threadId });

  // Load cached summary from thread data
  useEffect(() => {
    if (thread?.summary) {
      setSummary(thread.summary.content);
      setActionItems(thread.summary.actionItems || []);
      setLastGenerated(new Date(thread.summary.generatedAt));
      setUserFeedback(thread.summary.userFeedback || null);
    }
  }, [thread]);

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      const result = await generateSummary({ threadId });
      if (result.success) {
        setSummary((result as any).summary || '');
        setActionItems((result as any).actionItems || []);
        setLastGenerated(new Date());
        setUserFeedback(null); // Reset feedback for new summary
      } else {
        alert(
          'Failed to generate summary: ' + (result.error || 'Unknown error')
        );
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      alert('Failed to generate summary. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFeedback = async (feedback: 'helpful' | 'not_helpful') => {
    try {
      await saveFeedback({
        threadId,
        feedback,
        summaryVersion: lastGenerated?.getTime() || Date.now(),
      });
      setUserFeedback(feedback);
    } catch (error) {
      console.error('Error saving feedback:', error);
    }
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      await saveFeedback({
        threadId,
        feedback: 'edited',
        summaryVersion: lastGenerated?.getTime() || Date.now(),
        editedContent: editedSummary,
      });
      setSummary(editedSummary);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving edited summary:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const saveToNotion = async () => {
    try {
      const result = await fetch('/api/integrations/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          summary,
          actionItems,
          subject: thread?.subject,
        }),
      });

      if (result.ok) {
        alert('Summary saved to Notion successfully!');
      } else {
        alert(
          'Failed to save to Notion. Please check your integration settings.'
        );
      }
    } catch (error) {
      console.error('Error saving to Notion:', error);
      alert('Failed to save to Notion.');
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-blue-900">AI Summary</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleGenerateSummary}
            disabled={isGenerating}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            {isGenerating && (
              <div className="animate-spin rounded-full h-3 w-3 border-b border-white mr-1"></div>
            )}
            {isGenerating
              ? 'Generating...'
              : summary
                ? 'Regenerate'
                : 'Generate Summary'}
          </button>
          {summary && (
            <button
              onClick={saveToNotion}
              className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
              title="Save to Notion"
            >
              📝
            </button>
          )}
        </div>
      </div>

      {summary && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-medium text-blue-800">Summary</h4>
              <button
                onClick={() => {
                  setIsEditing(!isEditing);
                  setEditedSummary(summary);
                }}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  className="w-full p-2 text-sm border border-blue-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-blue-900">{summary}</p>
            )}
          </div>

          {actionItems.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-blue-800 mb-1">
                Action Items
              </h4>
              <ul className="text-sm text-blue-900 space-y-1">
                {actionItems.map((item, index) => (
                  <li key={index} className="flex items-start">
                    <input
                      type="checkbox"
                      className="mt-1 mr-2 h-3 w-3 text-blue-600 border-blue-300 rounded focus:ring-blue-500"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <div className="text-blue-600">
              Generated {lastGenerated?.toLocaleString()}
            </div>

            {!isEditing && (
              <div className="flex items-center space-x-2">
                <span className="text-blue-700">Was this helpful?</span>
                <button
                  onClick={() => handleFeedback('helpful')}
                  className={`p-1 rounded ${
                    userFeedback === 'helpful'
                      ? 'bg-green-100 text-green-600'
                      : 'text-blue-600 hover:bg-blue-100'
                  }`}
                >
                  👍
                </button>
                <button
                  onClick={() => handleFeedback('not_helpful')}
                  className={`p-1 rounded ${
                    userFeedback === 'not_helpful'
                      ? 'bg-red-100 text-red-600'
                      : 'text-blue-600 hover:bg-blue-100'
                  }`}
                >
                  👎
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface SmartReplyProps {
  threadId: Id<'threads'>;
  onReplyGenerated: (reply: string) => void;
}

export function SmartReply({ threadId, onReplyGenerated }: SmartReplyProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTone, setSelectedTone] = useState<
    'formal' | 'friendly' | 'short' | 'detailed'
  >('friendly');
  const [context, setContext] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [recentReplies, setRecentReplies] = useState<
    Array<{
      content: string;
      tone: string;
      timestamp: number;
      used: boolean;
    }>
  >([]);
  const [selectedReplyIndex, setSelectedReplyIndex] = useState<number | null>(
    null
  );

  const generateReply = useAction(api.ai.generateReply);
  const saveReplyFeedback = useMutation(api.ai.saveReplyFeedback);

  // Load recent replies from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`replies-${threadId}`);
    if (stored) {
      try {
        setRecentReplies(JSON.parse(stored));
      } catch (error) {
        console.error('Error loading recent replies:', error);
      }
    }
  }, [threadId]);

  const handleGenerateReply = async () => {
    setIsGenerating(true);
    try {
      const result = await generateReply({
        threadId,
        tone: selectedTone,
        context: context.trim() || undefined,
      });

      if (result.success && result.reply) {
        const newReply = {
          content: result.reply,
          tone: selectedTone,
          timestamp: Date.now(),
          used: false,
        };

        const updatedReplies = [newReply, ...recentReplies.slice(0, 4)]; // Keep last 5
        setRecentReplies(updatedReplies);
        localStorage.setItem(
          `replies-${threadId}`,
          JSON.stringify(updatedReplies)
        );

        setSelectedReplyIndex(0);
      } else {
        alert('Failed to generate reply: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error generating reply:', error);
      alert('Failed to generate reply. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseReply = async (index: number) => {
    const reply = recentReplies[index];
    if (!reply) return;

    // Mark as used and save feedback
    const updatedReplies = [...recentReplies];
    updatedReplies[index].used = true;
    setRecentReplies(updatedReplies);
    localStorage.setItem(`replies-${threadId}`, JSON.stringify(updatedReplies));

    try {
      await saveReplyFeedback({
        threadId,
        replyContent: reply.content,
        tone: reply.tone as any,
        feedback: 'used',
        timestamp: reply.timestamp,
      });
    } catch (error) {
      console.error('Error saving reply feedback:', error);
    }

    onReplyGenerated(reply.content);
  };

  const handleReplyFeedback = async (
    index: number,
    feedback: 'helpful' | 'not_helpful'
  ) => {
    const reply = recentReplies[index];
    if (!reply) return;

    try {
      await saveReplyFeedback({
        threadId,
        replyContent: reply.content,
        tone: reply.tone as any,
        feedback,
        timestamp: reply.timestamp,
      });
    } catch (error) {
      console.error('Error saving reply feedback:', error);
    }
  };

  const toneOptions = [
    {
      value: 'friendly' as const,
      label: 'Friendly',
      description: 'Warm and approachable',
      icon: '😊',
    },
    {
      value: 'formal' as const,
      label: 'Formal',
      description: 'Professional and respectful',
      icon: '👔',
    },
    {
      value: 'short' as const,
      label: 'Brief',
      description: 'Concise and to the point',
      icon: '⚡',
    },
    {
      value: 'detailed' as const,
      label: 'Detailed',
      description: 'Comprehensive and thorough',
      icon: '📝',
    },
  ];

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-purple-900">Smart Reply</h3>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-purple-600 hover:text-purple-800"
        >
          {showAdvanced ? 'Hide Options' : 'Show Options'}
        </button>
      </div>

      {showAdvanced && (
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-purple-800 mb-2">
              Tone & Style
            </label>
            <div className="grid grid-cols-2 gap-2">
              {toneOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedTone(option.value)}
                  className={`p-2 text-xs rounded border transition-colors ${
                    selectedTone === option.value
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50'
                  }`}
                >
                  <div className="flex items-center justify-center mb-1">
                    <span className="text-sm">{option.icon}</span>
                  </div>
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs opacity-75">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-purple-800 mb-1">
              Additional Context (Optional)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Add any specific context or instructions for the reply..."
              className="w-full p-2 text-sm border border-purple-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={2}
            />
          </div>
        </div>
      )}

      <button
        onClick={handleGenerateReply}
        disabled={isGenerating}
        className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center mb-4"
      >
        {isGenerating && (
          <div className="animate-spin rounded-full h-4 w-4 border-b border-white mr-2"></div>
        )}
        {isGenerating ? 'Generating Reply...' : 'Generate Smart Reply'}
      </button>

      {/* Recent Replies */}
      {recentReplies.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-purple-800">
            Generated Replies
          </h4>
          {recentReplies.map((reply, index) => (
            <div
              key={index}
              className={`p-3 rounded border ${
                selectedReplyIndex === index
                  ? 'border-purple-400 bg-purple-100'
                  : 'border-purple-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs px-2 py-1 bg-purple-200 text-purple-800 rounded">
                    {reply.tone}
                  </span>
                  <span className="text-xs text-purple-600">
                    {new Date(reply.timestamp).toLocaleTimeString()}
                  </span>
                  {reply.used && (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                      Used ✓
                    </span>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-800 mb-3 line-clamp-3">
                {reply.content}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleReplyFeedback(index, 'helpful')}
                    className="text-xs text-purple-600 hover:text-purple-800"
                  >
                    👍
                  </button>
                  <button
                    onClick={() => handleReplyFeedback(index, 'not_helpful')}
                    className="text-xs text-purple-600 hover:text-purple-800"
                  >
                    👎
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedReplyIndex(index)}
                    className="text-xs text-purple-600 hover:text-purple-800"
                  >
                    {selectedReplyIndex === index ? 'Selected' : 'Preview'}
                  </button>
                  <button
                    onClick={() => handleUseReply(index)}
                    className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    Use This Reply
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface PriorityClassificationProps {
  threadId: Id<'threads'>;
  existingClassification?: {
    category: string;
    priority: 'urgent' | 'high' | 'normal' | 'low';
    confidence: number;
    generatedAt: number;
  };
}

export function PriorityClassification({
  threadId,
  existingClassification,
}: PriorityClassificationProps) {
  const [isClassifying, setIsClassifying] = useState(false);

  const classifyPriority = useAction(api.ai.classifyEmailPriority);

  const handleClassify = async () => {
    setIsClassifying(true);
    try {
      // This would need the message content - in a real implementation,
      // you'd get this from the thread's messages
      const result = await classifyPriority({
        threadId,
        messageContent: 'Email content would go here',
      });
      if (!result.success) {
        console.error('Failed to classify priority:', result.error);
      }
    } catch (error) {
      console.error('Error classifying priority:', error);
    } finally {
      setIsClassifying(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'normal':
        return 'text-blue-600 bg-blue-100';
      case 'low':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-green-900">
          Priority Classification
        </h3>
        <button
          onClick={handleClassify}
          disabled={isClassifying}
          className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {isClassifying ? 'Analyzing...' : 'Analyze Priority'}
        </button>
      </div>

      {existingClassification && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(existingClassification.priority)}`}
            >
              {existingClassification.priority.toUpperCase()}
            </span>
            <span className="text-sm text-green-700">
              {existingClassification.category.replace('_', ' ')}
            </span>
          </div>
          <div className="text-xs text-green-600">
            Confidence: {Math.round(existingClassification.confidence * 100)}% •
            Generated{' '}
            {new Date(existingClassification.generatedAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
