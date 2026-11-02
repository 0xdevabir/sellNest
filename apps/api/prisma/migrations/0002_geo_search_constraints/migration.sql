-- PostgreSQL maintains these columns itself, so geography and search data cannot drift from their
-- sources. Dropping the placeholder column also drops the indexes Prisma created on it.
ALTER TABLE "Location" DROP COLUMN "geo";
ALTER TABLE "Location" ADD COLUMN "geo" geography(Point, 4326)
  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography) STORED;
CREATE INDEX "Location_geo_idx" ON "Location" USING GIST ("geo");

ALTER TABLE "Listing" DROP COLUMN "geo";
ALTER TABLE "Listing" ADD COLUMN "geo" geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE WHEN "latitude" IS NOT NULL AND "longitude" IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography END
  ) STORED;
CREATE INDEX "Listing_geo_idx" ON "Listing" USING GIST ("geo");

ALTER TABLE "Listing" DROP COLUMN "searchVector";
ALTER TABLE "Listing" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("brand", '') || ' ' || coalesce("model", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'C')
  ) STORED;
CREATE INDEX "Listing_searchVector_idx" ON "Listing" USING GIN ("searchVector");

-- Concurrency-proof business rules.
CREATE UNIQUE INDEX "Offer_one_open_per_buyer" ON "Offer" ("listingId", "buyerId")
  WHERE "status" IN ('PENDING', 'COUNTERED');
CREATE UNIQUE INDEX "Offer_one_accepted_per_listing" ON "Offer" ("listingId")
  WHERE "status" = 'ACCEPTED';

ALTER TABLE "Offer" ADD CONSTRAINT "Offer_buyer_not_seller" CHECK ("buyerId" <> "sellerId");
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_amount_positive" CHECK ("amountBdt" > 0);
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_buyer_not_seller" CHECK ("buyerId" <> "sellerId");
ALTER TABLE "Review" ADD CONSTRAINT "Review_not_self" CHECK ("reviewerId" <> "revieweeId");
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "Block" ADD CONSTRAINT "Block_not_self" CHECK ("blockerId" <> "blockedId");
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_price_positive" CHECK ("priceBdt" IS NULL OR "priceBdt" > 0);

-- Serves "my open reports" duplicate checks and case-insensitive admin search on users.
CREATE INDEX "Report_dedupe_idx" ON "Report" ("reporterId", "targetType", "status");
CREATE INDEX "User_username_trgm_idx" ON "User" USING GIN ("username" gin_trgm_ops);
CREATE INDEX "User_email_trgm_idx" ON "User" USING GIN ("email" gin_trgm_ops);
