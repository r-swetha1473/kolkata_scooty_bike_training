const FE = 'https://kolkata-scooty-bike-training.vercel.app';
const CHUNK = process.argv[2] || 'chunk-ACNWMQSB.js';

async function main() {
  const t = await fetch(`${FE}/${CHUNK}`).then((r) => r.text());
  const checks = {
    chunk: CHUNK,
    getTokenParam: t.includes("get('token')") || t.includes('get("token")'),
    setAuthToken: t.includes('setAuthToken') || t.includes('localStorage.setItem'),
    oauthSuccess: t.includes('oauth') && t.includes('success'),
    bearerHeader: t.includes('Bearer') || t.includes('Authorization'),
    withCredentials: t.includes('withCredentials')
  };
  console.log(JSON.stringify(checks, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
