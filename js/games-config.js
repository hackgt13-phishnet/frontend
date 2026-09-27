/* Games config. The publishable key is client-safe; never put the DB URL or JWT secret here. */
window.GAMES_CONFIG = {
  // serve.py proxies /v1 to the backend, so phones on the tunnel URL reach it with no CORS setup.
  apiBase: '/v1',
  supabaseUrl: 'https://cpjwhzvgdxrkuxnmlrmy.supabase.co',
  supabaseAnonKey: 'sb_publishable_jseoR2P79yEz-G2DPgF8Gw_RMew9vkV',
  // Phones are dealt one of these at random. Other rows in `profiles` (e.g. teammates'
  // test copies) are never handed out.
  demoPlayers: ['Ana', 'Dev', 'Kofi', 'Maya', 'Riya', 'Sam'],
};
