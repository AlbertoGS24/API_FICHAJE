-- Normalize existing phones to an international E.164-like format when possible.
UPDATE "User"
SET "phone" = NULL
WHERE "phone" IS NOT NULL
  AND btrim("phone") = '';

UPDATE "User"
SET "phone" = CASE
  WHEN regexp_replace("phone", '[\s().-]+', '', 'g') ~ '^00[1-9][0-9]{7,14}$'
    THEN '+' || substring(regexp_replace("phone", '[\s().-]+', '', 'g') from 3)
  WHEN regexp_replace("phone", '[\s().-]+', '', 'g') ~ '^[6789][0-9]{8}$'
    THEN '+34' || regexp_replace("phone", '[\s().-]+', '', 'g')
  WHEN regexp_replace("phone", '[\s().-]+', '', 'g') ~ '^\+[1-9][0-9]{7,14}$'
    THEN regexp_replace("phone", '[\s().-]+', '', 'g')
  ELSE "phone"
END
WHERE "phone" IS NOT NULL;
