ALTER TABLE products ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;--> statement-breakpoint
UPDATE products 
SET sort_order = (
  SELECT COUNT(*) 
  FROM products p2 
  WHERE p2.category < products.category 
    OR (p2.category = products.category AND p2.name <= products.name)
) - 1;