-- Native Android devices register an FCM token instead of a Web Push endpoint.
ALTER TABLE "PushSubscription" ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'web';
ALTER TABLE "PushSubscription" ALTER COLUMN "p256dh" SET DEFAULT '';
ALTER TABLE "PushSubscription" ALTER COLUMN "auth" SET DEFAULT '';
