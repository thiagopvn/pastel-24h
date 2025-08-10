-- Adicionar campos de horas trabalhadas e consumo interno aos colaboradores
ALTER TABLE shift_collaborators ADD COLUMN hours_worked TEXT DEFAULT '0.00';
ALTER TABLE shift_collaborators ADD COLUMN internal_consumption TEXT DEFAULT '0.00';