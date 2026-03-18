import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const EMOJI_LIST = [
  "📋", "📝", "📄", "📑", "📁", "📂", "🗂️", "📊", "📈", "📉",
  "🚗", "✈️", "🚆", "🏖️", "🏠", "🏢", "🏛️", "🏗️", "🏭", "🏫",
  "🚶", "🏃", "🧑‍💼", "👨‍💼", "👩‍💼", "👥", "🤝", "💼", "🎒", "📦",
  "📦", "🛒", "💰", "💵", "💳", "🧾", "🏷️", "📮", "📬", "📨",
  "⏰", "📅", "🗓️", "⏳", "🔔", "📢", "📣", "🔑", "🔒", "🛡️",
  "✅", "❌", "⚠️", "❗", "❓", "💡", "🔧", "⚙️", "🔩", "🛠️",
  "📱", "💻", "🖥️", "🖨️", "📞", "📟", "📠", "🔋", "🔌", "💾",
  "🎯", "🏆", "⭐", "🌟", "💎", "🎉", "🎊", "🎁", "🎀", "🏅",
  "📌", "📍", "🗺️", "🧭", "🚩", "🏁", "🔰", "♻️", "✳️", "❇️",
  "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪", "🟤", "🔶",
];

interface EmojiIconPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

const EmojiIconPicker = ({ value, onChange }: EmojiIconPickerProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-20 h-20 text-4xl p-0">
          {value || "📋"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <Input
          placeholder="搜索图标..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />
        <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
          {EMOJI_LIST.map((emoji, i) => (
            <Button
              key={`${emoji}-${i}`}
              variant={value === emoji ? "default" : "ghost"}
              className="w-8 h-8 p-0 text-lg"
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </Button>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t">
          <Input
            placeholder="直接输入 emoji..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="text-center text-lg"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EmojiIconPicker;
