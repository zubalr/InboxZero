'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useState, useRef, useEffect } from 'react';

interface CommentsSidebarProps {
  threadId: Id<'threads'>;
}

interface Comment {
  _id: Id<'comments'>;
  _creationTime: number;
  threadId: Id<'threads'>;
  authorId: Id<'users'>;
  content: string;
  parentCommentId?: Id<'comments'>;
  reactions?: Array<{
    emoji: string;
    userId: Id<'users'>;
    createdAt: number;
  }>;
  isEdited: boolean;
  createdAt: number;
  updatedAt: number;
  user: {
    _id: Id<'users'>;
    name: string;
    email: string;
  };
}

export function CommentsSidebar({ threadId }: CommentsSidebarProps) {
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Id<'comments'> | null>(null);
  const [editingComment, setEditingComment] = useState<Id<'comments'> | null>(
    null
  );
  const [editContent, setEditContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<Id<'comments'> | null>(
    null
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const comments = useQuery(api.comments.listForThread, { threadId });
  const addComment = useMutation(api.comments.addComment);
  const updateComment = useMutation(api.comments.updateComment);
  const addReaction = useMutation(api.comments.addReaction);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [newComment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addComment({
        threadId,
        content: newComment.trim(),
        parentCommentId: replyingTo || undefined,
      });
      setNewComment('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Failed to add comment:', error);
      alert('Failed to add comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (commentId: Id<'comments'>) => {
    if (!editContent.trim()) return;

    try {
      await updateComment({
        commentId,
        content: editContent.trim(),
      });
      setEditingComment(null);
      setEditContent('');
    } catch (error) {
      console.error('Failed to edit comment:', error);
      alert('Failed to edit comment. Please try again.');
    }
  };

  const handleReaction = async (commentId: Id<'comments'>, emoji: string) => {
    try {
      // The API handles toggle automatically
      await addReaction({
        commentId,
        emoji,
      });
      setShowEmojiPicker(null);
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const insertFormatting = (
    type: 'bold' | 'italic' | 'code',
    textarea: HTMLTextAreaElement,
    content: string,
    setContent: (content: string) => void
  ) => {
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
      case 'code':
        replacement = `\`${selectedText || 'code'}\``;
        break;
    }

    const newContent =
      content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + replacement.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const renderFormattedContent = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>')
      .replace(/\n/g, '<br>');
  };

  const groupCommentsByThread = (comments: Comment[]) => {
    const rootComments = comments.filter((c) => !c.parentCommentId);
    const threaded = rootComments.map((root) => ({
      ...root,
      replies: comments.filter((c) => c.parentCommentId === root._id),
    }));
    return threaded;
  };

  const commonEmojis = ['👍', '👎', '❤️', '😊', '😮', '🎉', '🚀', '💯'];

  if (comments === undefined) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-4">Comments</h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  const threadedComments = groupCommentsByThread(comments);

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="flex-shrink-0 p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold">Team Comments</h3>
        <p className="text-xs text-gray-500 mt-1">
          Internal discussion about this email
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {threadedComments.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">No comments yet</p>
            <p className="text-gray-400 text-xs mt-1">
              Start the discussion about this email
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {threadedComments.map((comment) => (
              <div key={comment._id} className="space-y-2">
                {/* Main Comment */}
                <div className="bg-gray-50 rounded-lg p-3 border-l-2 border-blue-500">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                        {comment.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {comment.user.name}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {comment.isEdited && (
                        <span className="text-xs text-gray-400">edited</span>
                      )}
                      <button
                        onClick={() => {
                          setEditingComment(comment._id);
                          setEditContent(comment.content);
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        ✏️
                      </button>
                    </div>
                  </div>

                  {editingComment === comment._id ? (
                    <div className="space-y-2">
                      <div className="border border-gray-300 rounded">
                        <div className="flex items-center justify-between p-2 bg-gray-100 border-b border-gray-300">
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => {
                                const textarea =
                                  e.currentTarget.parentElement?.parentElement?.querySelector(
                                    'textarea'
                                  );
                                if (textarea)
                                  insertFormatting(
                                    'bold',
                                    textarea,
                                    editContent,
                                    setEditContent
                                  );
                              }}
                              className="p-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded"
                            >
                              <strong>B</strong>
                            </button>
                            <button
                              onClick={(e) => {
                                const textarea =
                                  e.currentTarget.parentElement?.parentElement?.querySelector(
                                    'textarea'
                                  );
                                if (textarea)
                                  insertFormatting(
                                    'italic',
                                    textarea,
                                    editContent,
                                    setEditContent
                                  );
                              }}
                              className="p-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded italic"
                            >
                              I
                            </button>
                            <button
                              onClick={(e) => {
                                const textarea =
                                  e.currentTarget.parentElement?.parentElement?.querySelector(
                                    'textarea'
                                  );
                                if (textarea)
                                  insertFormatting(
                                    'code',
                                    textarea,
                                    editContent,
                                    setEditContent
                                  );
                              }}
                              className="p-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded font-mono"
                            >
                              &lt;/&gt;
                            </button>
                          </div>
                          <div className="text-xs text-gray-500">
                            Markdown supported
                          </div>
                        </div>
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full p-2 text-sm resize-none focus:outline-none"
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => {
                            setEditingComment(null);
                            setEditContent('');
                          }}
                          className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleEdit(comment._id)}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="text-sm text-gray-700"
                      dangerouslySetInnerHTML={{
                        __html: renderFormattedContent(comment.content),
                      }}
                    />
                  )}

                  {/* Reactions */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex flex-wrap gap-1">
                      {comment.reactions
                        ?.reduce(
                          (acc, reaction) => {
                            const existing = acc.find(
                              (r) => r.emoji === reaction.emoji
                            );
                            if (existing) {
                              existing.count++;
                              existing.userIds.push(reaction.userId);
                            } else {
                              acc.push({
                                emoji: reaction.emoji,
                                count: 1,
                                userIds: [reaction.userId],
                              });
                            }
                            return acc;
                          },
                          [] as Array<{
                            emoji: string;
                            count: number;
                            userIds: Id<'users'>[];
                          }>
                        )
                        ?.map((reaction, index) => (
                          <button
                            key={index}
                            onClick={() =>
                              handleReaction(comment._id, reaction.emoji)
                            }
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-white border border-gray-200 hover:bg-gray-50"
                            title={`${reaction.count} reaction${reaction.count > 1 ? 's' : ''}`}
                          >
                            {reaction.emoji} {reaction.count}
                          </button>
                        ))}
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <button
                          onClick={() =>
                            setShowEmojiPicker(
                              showEmojiPicker === comment._id
                                ? null
                                : comment._id
                            )
                          }
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          😊
                        </button>
                        {showEmojiPicker === comment._id && (
                          <div className="absolute bottom-full right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
                            <div className="grid grid-cols-4 gap-1">
                              {commonEmojis.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() =>
                                    handleReaction(comment._id, emoji)
                                  }
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          setReplyingTo(
                            replyingTo === comment._id ? null : comment._id
                          )
                        }
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                </div>

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="ml-6 space-y-2">
                    {comment.replies.map((reply) => (
                      <div
                        key={reply._id}
                        className="bg-white rounded-lg p-3 border border-gray-200"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-medium">
                              {reply.user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-900">
                                {reply.user.name}
                              </span>
                              <span className="text-xs text-gray-500 ml-2">
                                {formatDate(reply.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div
                          className="text-sm text-gray-700"
                          dangerouslySetInnerHTML={{
                            __html: renderFormattedContent(reply.content),
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Form */}
                {replyingTo === comment._id && (
                  <div className="ml-6">
                    <form onSubmit={handleSubmit} className="space-y-2">
                      <div className="border border-gray-300 rounded">
                        <div className="flex items-center justify-between p-2 bg-gray-50 border-b border-gray-300">
                          <div className="text-xs text-gray-600">
                            Replying to {comment.user.name}
                          </div>
                          <button
                            type="button"
                            onClick={() => setReplyingTo(null)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            ✕
                          </button>
                        </div>
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Write a reply..."
                          className="w-full px-3 py-2 text-sm resize-none focus:outline-none"
                          rows={2}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={!newComment.trim() || isSubmitting}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? 'Sending...' : 'Reply'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Comment Form */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="border border-gray-300 rounded">
            <div className="flex items-center justify-between p-2 bg-gray-50 border-b border-gray-300">
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => {
                    const textarea = textareaRef.current;
                    if (textarea)
                      insertFormatting(
                        'bold',
                        textarea,
                        newComment,
                        setNewComment
                      );
                  }}
                  className="p-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded"
                >
                  <strong>B</strong>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const textarea = textareaRef.current;
                    if (textarea)
                      insertFormatting(
                        'italic',
                        textarea,
                        newComment,
                        setNewComment
                      );
                  }}
                  className="p-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded italic"
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const textarea = textareaRef.current;
                    if (textarea)
                      insertFormatting(
                        'code',
                        textarea,
                        newComment,
                        setNewComment
                      );
                  }}
                  className="p-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded font-mono"
                >
                  &lt;/&gt;
                </button>
              </div>
              <div className="text-xs text-gray-500">Markdown supported</div>
            </div>
            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment to discuss this email with your team..."
              className="w-full px-3 py-2 text-sm resize-none focus:outline-none min-h-[3rem]"
              disabled={isSubmitting}
            />
          </div>
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500">
              **bold**, *italic*, `code`
            </div>
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                  Posting...
                </>
              ) : (
                'Post Comment'
              )}
            </button>
          </div>
        </form>
        <div className="mt-2 text-xs text-gray-500">
          Comments are only visible to your team members
        </div>
      </div>
    </div>
  );
}
