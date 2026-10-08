-- No existing reservation is rewritten or backfilled.
CREATE TABLE "EconomicInventoryReacquisition" (
  "id" TEXT PRIMARY KEY DEFAULT nanoid(12),
  "reservationId" TEXT NOT NULL UNIQUE REFERENCES "EconomicInventoryReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "captureId" TEXT NOT NULL REFERENCES "EconomicCapture"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "quantity" INTEGER NOT NULL CHECK ("quantity">0), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "EconomicInventoryReacquisition_captureId_idx" ON "EconomicInventoryReacquisition"("captureId");
CREATE TRIGGER "EconomicInventoryReacquisition_immutable" BEFORE UPDATE OR DELETE ON "EconomicInventoryReacquisition" FOR EACH ROW EXECUTE FUNCTION economic_reject_snapshot_update();
CREATE FUNCTION economic_inventory_reacquisition_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "EconomicInventoryReservation"%ROWTYPE; c "EconomicCapture"%ROWTYPE;
BEGIN
  SELECT * INTO STRICT c FROM "EconomicCapture" WHERE "id"=NEW."captureId";
  PERFORM "id" FROM "EconomicOrderContext" WHERE "id"=c."contextId" FOR UPDATE;
  SELECT * INTO STRICT r FROM "EconomicInventoryReservation" WHERE "id"=NEW."reservationId";
  IF r."contextId"<>c."contextId" OR r."quantity"<>NEW."quantity" OR r."state" NOT IN ('EXPIRED','RELEASED')
    OR r."releasedAt" IS NULL THEN RAISE EXCEPTION 'Reacquisition requires original released pool and verified capture'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "EconomicInventoryReacquisition_binding" BEFORE INSERT ON "EconomicInventoryReacquisition" FOR EACH ROW EXECUTE FUNCTION economic_inventory_reacquisition_guard();

CREATE FUNCTION economic_inventory_terminal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."state"<>'HELD' OR NEW."state" NOT IN ('CONSUMED','RELEASED','EXPIRED') THEN
    RAISE EXCEPTION 'Reservation cannot be reset; late stock requires reacquisition evidence';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "EconomicInventoryReservation_zz_terminal" BEFORE UPDATE ON "EconomicInventoryReservation" FOR EACH ROW EXECUTE FUNCTION economic_inventory_terminal_guard();
