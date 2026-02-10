import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 智能解析时间字符串：
 * - 带时区标记(Z或+00:00)的UTC时间 → new Date()自动转换为本地时间
 * - 无时区标记 → 当作本地时间解析
 */
export const parseTime = (value: string): Date => {
  if (!value) return new Date();
  // 如果有Z后缀或时区偏移，说明是UTC时间，直接用new Date转换为本地
  if (/Z$/.test(value) || /[+-]\d{2}:\d{2}$/.test(value)) {
    return new Date(value);
  }
  // 无时区标记，当作本地时间解析
  const cleaned = value.replace('T', ' ').replace(/\.\d+$/, '');
  const parts = cleaned.split(/[- :]/);
  if (parts.length >= 5) {
    return new Date(
      parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]),
      parseInt(parts[3]), parseInt(parts[4]), parseInt(parts[5] || '0')
    );
  }
  return new Date(value);
};

/**
 * 生成本地时间的ISO格式字符串（不含Z后缀），用于写入数据库
 */
export const formatLocalNow = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
