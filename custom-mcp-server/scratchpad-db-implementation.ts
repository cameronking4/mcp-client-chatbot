/**
 * Scratchpad Memory Implementation
 * 
 * This file provides a simple in-memory implementation for the scratchpad memory feature.
 */

/**
 * Simple in-memory scratchpad implementation
 */
export class InMemoryScratchpad {
  private storage = new Map<string, string>();
  
  // Namespace keys for isolation
  private getKey(namespaceId: string, key: string): string {
    return `${namespaceId}:${key}`;
  }

  async storeValue(namespaceId: string, key: string, value: string): Promise<void> {
    this.storage.set(this.getKey(namespaceId, key), value);
  }

  async getValue(namespaceId: string, key: string): Promise<string | undefined> {
    return this.storage.get(this.getKey(namespaceId, key));
  }

  async listKeys(namespaceId: string): Promise<string[]> {
    const namespacePrefix = `${namespaceId}:`;
    const keys: string[] = [];
    
    for (const fullKey of this.storage.keys()) {
      if (fullKey.startsWith(namespacePrefix)) {
        keys.push(fullKey.substring(namespacePrefix.length));
      }
    }
    
    return keys;
  }

  async deleteValue(namespaceId: string, key: string): Promise<boolean> {
    return this.storage.delete(this.getKey(namespaceId, key));
  }
}

// Create a singleton instance for easy import
export const memoryStore = new InMemoryScratchpad(); 