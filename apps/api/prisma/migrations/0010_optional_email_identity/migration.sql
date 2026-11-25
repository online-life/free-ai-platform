-- Email remains optional profile metadata for existing installations. Authentication
-- and owner bootstrap use the username and do not depend on email delivery.
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "normalized_email" DROP NOT NULL;
