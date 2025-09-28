-- Add cumulative card payment fields to shift_payments table
ALTER TABLE shift_payments ADD COLUMN stone_card_cumulative TEXT DEFAULT '0';
ALTER TABLE shift_payments ADD COLUMN stone_voucher_cumulative TEXT DEFAULT '0';
ALTER TABLE shift_payments ADD COLUMN pagbank_card_cumulative TEXT DEFAULT '0';
ALTER TABLE shift_payments ADD COLUMN calculated_from_cumulative INTEGER DEFAULT 0;

-- Update existing records to have cumulative values equal to real values
UPDATE shift_payments
SET
  stone_card_cumulative = COALESCE(stone_card, '0'),
  stone_voucher_cumulative = COALESCE(stone_voucher, '0'),
  pagbank_card_cumulative = COALESCE(pagbank_card, '0'),
  calculated_from_cumulative = 0
WHERE stone_card_cumulative IS NULL;