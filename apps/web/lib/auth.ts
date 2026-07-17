// Token management helpers

export function generateVerificationToken(userId: string): string {
  return btoa(`${userId}:${Date.now()}`);
}
