import React, { useState, useRef } from 'react';

interface MentionDropdownProps {
  value: string;
  onChange: (val: string) => void;
  members: { user_id: string; user_name: string; user_email: string; user_role?: string; user_avatar?: string }[];
  placeholder?: string;
  className?: string;
  rows?: number;
  as?: 'input' | 'textarea';
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
}

export default function MentionDropdown({
  value,
  onChange,
  members,
  placeholder,
  className,
  rows,
  as = 'input',
  onKeyDown,
  onBlur,
  autoFocus,
}: MentionDropdownProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<any>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart || 0;
    setCursorPos(pos);
    onChange(val);

    // Check if user is typing a mention (look backwards from cursor for '@')
    const textBeforeCursor = val.substring(0, pos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // If there is no whitespace between '@' and cursor, we are actively searching
      if (!/\s/.test(textAfterAt)) {
        setQuery(textAfterAt);
        setShowDropdown(true);
        setSelectedIndex(0);
        return;
      }
    }
    setShowDropdown(false);
  };

  const filteredMembers = members.filter((m) =>
    m.user_name.toLowerCase().includes(query.toLowerCase()) ||
    m.user_email.toLowerCase().includes(query.toLowerCase())
  );

  const selectMember = (member: { user_name: string }) => {
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex === -1) return;

    const textAfterCursor = value.substring(cursorPos);
    const newText = value.substring(0, lastAtIndex) + `@${member.user_name} ` + textAfterCursor;
    onChange(newText);
    setShowDropdown(false);

    // Refocus and set cursor
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = lastAtIndex + member.user_name.length + 2;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 50);
  };

  const handleKeyDownInternal = (e: React.KeyboardEvent) => {
    if (showDropdown && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMember(filteredMembers[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowDropdown(false);
        return;
      }
    }
    if (onKeyDown) onKeyDown(e);
  };

  return (
    <div className="relative w-full">
      {as === 'textarea' ? (
        <textarea
          ref={inputRef}
          rows={rows || 3}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDownInternal}
          onBlur={onBlur}
          placeholder={placeholder}
          className={className}
          autoFocus={autoFocus}
        />
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDownInternal}
          onBlur={onBlur}
          placeholder={placeholder}
          className={className}
          autoFocus={autoFocus}
        />
      )}

      {showDropdown && filteredMembers.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100">
          <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Mention Organization Member
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredMembers.map((m, idx) => (
              <div
                key={m.user_id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectMember(m);
                }}
                className={`px-3 py-2 flex items-center gap-2.5 cursor-pointer text-xs transition-colors ${idx === selectedIndex ? 'bg-teal-50 text-teal-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'}`}
              >
                <img
                  src={m.user_avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.user_name)}`}
                  alt={m.user_name}
                  className="w-6 h-6 rounded-full object-cover bg-slate-200"
                />
                <div className="flex-1 truncate">
                  <div className="font-bold text-slate-900">{m.user_name}</div>
                  <div className="text-[10px] text-slate-500">{m.user_role || m.user_email}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
