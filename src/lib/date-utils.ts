import { formatDistanceToNow } from 'date-fns';

/**
 * Formats a date as a relative time string (e.g., "2h", "3d", "1w")
 * @param date The date to format
 * @returns A short abbreviation of the time difference between now and the given date
 */
export function formatTimeAgo(date: Date): string {
  const now = new Date();
  
  // Calculate the difference in milliseconds
  const diffMs = now.getTime() - date.getTime();
  
  // Convert to various time units
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  
  // Return the appropriate abbreviation
  if (diffSeconds < 60) {
    return 'now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  } else if (diffHours < 24) {
    return `${diffHours}h`;
  } else if (diffDays < 7) {
    return `${diffDays}d`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks}w`;
  } else if (diffMonths < 12) {
    return `${diffMonths}mo`;
  } else {
    return `${diffYears}y`;
  }
}

/**
 * A more detailed version of formatTimeAgo that uses date-fns
 * @param date The date to format
 * @returns A more detailed relative time string
 */
export function formatRelativeTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
} 