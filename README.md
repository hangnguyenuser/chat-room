This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the front end from root directory

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Second, run the backend from /app
node server/websocket.ts

Step 1 Done: basic send message + broadcast functionality
Step 2 Done: Username per socket
    - Client sends username once
    - Server attaches it to that socket
    - Every message uses socket.data.username
Step 3 Done: Have multiple chat rooms
    - Room membership (which socket is in which room)
    - Message routing (emit to correct room)
    - UI state
Step 4 Done: Allow users to create chatrooms
    - Server-side room management
        - room list and create room handler
    - Client-side room list sync
        - request rooms on connect
        - keep them in React state
        - listen for server broadcasts
        - emit create_room with a callback
    - Add room creation UI
    - Validate room name: server-side validation, client-side UI feedback for errors
Step 5: Add message acknowledgements
    - Add message acknowledgment callbacks (server)
    - Add message acknowledgment callbacks (client)
        - upsertMessages avoids duplicates
        - uses message ID
    - Typing indicators

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
