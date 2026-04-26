CREATE TYPE "ServiceUnit" AS ENUM ('PZ', 'MQ', 'ML');

ALTER TABLE "ServiceCatalog"
ADD COLUMN "unit" "ServiceUnit" NOT NULL DEFAULT 'PZ';

UPDATE "ServiceCatalog"
SET "unit" = 'MQ'
WHERE
  lower(coalesce("code", '') || ' ' || coalesce("name", '') || ' ' || coalesce("description", '')) LIKE '%prezzo al mq%'
  OR lower(coalesce("code", '') || ' ' || coalesce("name", '') || ' ' || coalesce("description", '')) LIKE '% al mq%'
  OR lower(coalesce("code", '') || ' ' || coalesce("name", '') || ' ' || coalesce("description", '')) ~ '(^|[^a-z0-9])(mq|m2|metro quadro|metri quadri)([^a-z0-9]|$)';

UPDATE "ServiceCatalog"
SET "unit" = 'ML'
WHERE
  "unit" = 'PZ'
  AND (
    lower(coalesce("code", '') || ' ' || coalesce("name", '') || ' ' || coalesce("description", '')) LIKE '%prezzo al ml%'
    OR lower(coalesce("code", '') || ' ' || coalesce("name", '') || ' ' || coalesce("description", '')) LIKE '% al ml%'
    OR lower(coalesce("code", '') || ' ' || coalesce("name", '') || ' ' || coalesce("description", '')) ~ '(^|[^a-z0-9])(ml|metro lineare|metri lineari)([^a-z0-9]|$)'
  );
