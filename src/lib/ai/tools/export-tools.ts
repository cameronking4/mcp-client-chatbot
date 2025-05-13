import { defaultTools } from './index';
import { Tool } from 'ai';

/**
 * Combine default tools with custom tools
 * 
 * @param customTools - Custom tools to add to the default set
 * @returns A merged object of default and custom tools
 */
export function combineTools(customTools: Record<string, Tool> = {}) {
  return { ...defaultTools, ...customTools };
} 