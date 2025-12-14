-- NOVO: Migração para adicionar campo midnight_card_values na tabela shifts
-- Este campo armazena um snapshot dos valores acumulados das maquininhas à meia-noite
-- Usado para turnos que cruzam a meia-noite, quando as maquininhas zeram o acumulado

ALTER TABLE shifts ADD COLUMN midnight_card_values TEXT;
