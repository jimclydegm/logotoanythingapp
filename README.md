# LogoToAnything

To run the LogoToAnything application, first install the npm dependencies:

```bash
npm install
```

Next, run the development server:

```bash
npm run dev
```

Finally, open [http://localhost:3000](http://localhost:3000) in your browser to view the website.

## Authentication Setup

This application uses NextAuth.js for authentication. To enable Google Sign-in, you need to:

1. Create OAuth credentials in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Add the following to your `.env.local` file:

```
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NEXTAUTH_SECRET="a-random-string-for-encryption"
NEXTAUTH_URL="http://localhost:3000"
```

For authorized redirect URIs in Google Cloud Console, add:
- http://localhost:3000/api/callback/google

GitHub authentication is also configured but currently disabled.
