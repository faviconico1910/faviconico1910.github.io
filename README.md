# s4lm0n Security Notes

## Run locally

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create `.env` from `.env.example` and set two private values:

   ```env
   ADMIN_PASSWORD=use-a-long-unique-password
   SESSION_SECRET=use-a-long-random-secret
   PORT=3000
   ```

3. Start the server:

   ```sh
   npm start
   ```

Open `http://127.0.0.1:3000` for the blog and `http://127.0.0.1:3000/admin` for the private Markdown inbox. The Express server listens only on loopback, so it is not reachable from other machines.

The server accepts only `.md`/`.markdown` files up to 2 MB. Uploaded drafts are stored under `private/markdown-inbox/`, which is excluded from Git and is not exposed by the web server. Uploads are not published automatically. Only the site root, public assets, and the `posts/` directory are statically accessible.

After uploading, use the `Preview` button in the private inbox to render the Markdown draft for review.

For public deployment, use HTTPS, a persistent session store instead of the default in-memory store, and keep `.env` outside version control.
