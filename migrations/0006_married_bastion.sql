INSERT INTO `shift_collaborators_new` (`id`, `shift_id`, `user_id`, `hours_worked`, `added_at`)
SELECT `id`, `shift_id`, `user_id`, `hours_worked`, `added_at` FROM `shift_collaborators`;