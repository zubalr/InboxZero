'use client';

import { useState } from 'react';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

const EMOJI_CATEGORIES = {
  reactions: ['👍', '👎', '❤️', '😂', '😮', '😢', '😡', '🎉'],
  faces: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇'],
  gestures: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇'],
  objects: ['🎉', '🎊', '🔥', '💯', '✨', '⭐', '🌟', '💫', '🎯', '🎪', '🎨', '🎭'],
};

export function EmojiPicker({ onEmojiSelect, onClose, isOpen }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<keyof typeof EMOJI_CATEGORIES>('reactions');

  if (!isOpen) return null;

  return (
    <div className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64">
      <div className="flex space-x-1 mb-3 border-b pb-2">
        {Object.keys(EMOJI_CATEGORIES).map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category as keyof typeof EMOJI_CATEGORIES)}
            className={`px-2 py-1 text-xs rounded capitalize ${
              activeCategory === category
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {category}
          </button>
        ))}
      </div>
      
      <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto">
        {EMOJI_CATEGORIES[activeCategory].map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onEmojiSelect(emoji);
              onClose();
            }}
            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 rounded"
          >
            {emoji}
          </button>
        ))}
      </div>
      
      <div className="flex justify-end mt-2 pt-2 border-t">
        <button
          onClick={onClose}
          className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800"
        >
          Close
        </button>
      </div>
    </div>
  );
}

interface EmojiReactionsProps {
  reactions?: Array<{
    emoji: string;
    userId: string;
    createdAt: number;
  }>;
  onAddReaction: (emoji: string) => void;
  currentUserId: string;
}

export function EmojiReactions({ reactions = [], onAddReaction, currentUserId }: EmojiReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, typeof reactions>);

  const handleReactionClick = (emoji: string) => {
    onAddReaction(emoji);
  };

  return (
    <div className="flex items-center space-x-2 mt-2">
      {Object.entries(groupedReactions).map(([emoji, reactionList]) => {
        const hasUserReacted = reactionList.some(r => r.userId === currentUserId);
        return (
          <button
            key={emoji}
            onClick={() => handleReactionClick(emoji)}
            className={`flex items-center space-x-1 px-2 py-1 rounded-full text-sm border ${
              hasUserReacted
                ? 'bg-blue-100 border-blue-300 text-blue-700'
                : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>{emoji}</span>
            <span className="text-xs">{reactionList.length}</span>
          </button>
        );
      })}
      
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
          title="Add reaction"
        >
          😊
        </button>
        
        <EmojiPicker
          isOpen={showPicker}
          onEmojiSelect={handleReactionClick}
          onClose={() => setShowPicker(false)}
        />
      </div>
    </div>
  );
}