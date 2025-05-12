/**
 * Auth module
 */

// Simplified auth helper for the API endpoints
export const auth = async () => {
  // In a real implementation, this would verify the user's session
  // For now, we'll return a simple mock user session
  return {
    user: {
      id: 'mock-user-id',
      name: 'Mock User',
      email: 'mock@example.com',
    }
  };
}; 