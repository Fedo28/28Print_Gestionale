import webPush from "web-push";

const keys = webPush.generateVAPIDKeys();

console.log("Aggiungi queste variabili all'ambiente del gestionale:");
console.log("");
console.log(`WEB_PUSH_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`WEB_PUSH_VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("WEB_PUSH_VAPID_SUBJECT=mailto:shop@28print.it");
