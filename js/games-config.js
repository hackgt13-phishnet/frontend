/* Games config. The publishable key is client-safe; never put the DB URL or JWT secret here. */
window.GAMES_CONFIG = {
  // serve.py proxies /v1 to the backend, so phones on the tunnel URL reach it with no CORS setup.
  apiBase: '/v1',
  supabaseUrl: 'https://cpjwhzvgdxrkuxnmlrmy.supabase.co',
  supabaseAnonKey: 'sb_publishable_jseoR2P79yEz-G2DPgF8Gw_RMew9vkV',
  // Phones are dealt one of these at random. Other rows in `profiles` (e.g. teammates'
  // test copies) are never handed out.
  demoPlayers: ['Ana', 'Dev', 'Kofi', 'Maya', 'Riya', 'Sam'],
  // Demo profiles have no photos in the DB; the games UI shows these faces instead.
  avatars: {
    Ana: 'https://i.pravatar.cc/150?img=45',
    Dev: 'https://i.pravatar.cc/150?img=12',
    Kofi: 'https://i.pravatar.cc/150?img=60',
    Maya: 'https://i.pravatar.cc/150?img=44',
    Riya: 'https://i.pravatar.cc/150?img=49',
    Sam: 'https://i.pravatar.cc/150?img=14',
    Roshan: 'https://i.pravatar.cc/150?img=8',
    Ayaan: 'https://i.pravatar.cc/150?img=15',
    Kabir: 'https://i.pravatar.cc/150?img=25',
    Shrey: 'https://i.pravatar.cc/150?img=32',
  },
};
