ALTER TABLE "dict_tag" ADD COLUMN "is_global" BOOLEAN NOT NULL DEFAULT 1;

CREATE TABLE "dict_tag_material" (
  "tag_id" INTEGER NOT NULL,
  "material_id" INTEGER NOT NULL,
  PRIMARY KEY ("tag_id", "material_id"),
  CONSTRAINT "dict_tag_material_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "dict_tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "dict_tag_material_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "dict_material" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_tag_material_material" ON "dict_tag_material"("material_id");
CREATE INDEX "idx_tag_material_tag" ON "dict_tag_material"("tag_id");
