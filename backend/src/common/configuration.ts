export default () => ({
  database_url: process.env.DATABASE_URL,
  node_env: process.env.NODE_ENV,
  frontend_url: process.env.FRONTEND_URL,
  zoho: {
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    redirect_url: process.env.ZOHO_REDIRECT_URL,
    scope: process.env.ZOHO_SCOPE,
    organization_id: process.env.ZOHO_ORGANIZATION_ID,
  },
});
