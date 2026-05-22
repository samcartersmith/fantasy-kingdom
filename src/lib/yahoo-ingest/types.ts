export type YahooStoredTokens = {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  leagueIds: string[];
};

export type YahooTokensFile = {
  users: YahooStoredTokens[];
};
