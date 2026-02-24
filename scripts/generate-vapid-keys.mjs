import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
const subject = "mailto:you@example.com";

console.log("");
console.log("Paste the following into your .env:");
console.log("");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${keys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${keys.privateKey}"`);
console.log(`VAPID_SUBJECT="${subject}"`);
console.log("");
console.log("For Vercel, add the same values in Project Settings -> Environment Variables.");
console.log("");
