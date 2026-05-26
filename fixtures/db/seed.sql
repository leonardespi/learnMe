-- Seed data for integration tests
-- Requires migrations to have been applied first

INSERT INTO categories (id, name, color, created_at, updated_at) VALUES
    ('01960000-0000-7000-8000-000000000001', 'Idiomas',     '#FF6B1A', '2026-01-01T10:00:00Z', '2026-01-01T10:00:00Z'),
    ('01960000-0000-7000-8000-000000000002', 'Matemáticas', '#B026FF', '2026-01-01T11:00:00Z', '2026-01-01T11:00:00Z');

INSERT INTO studies (id, category_id, method, name, payload_json, created_at, updated_at) VALUES
    ('01960000-0000-7000-8000-000000000010', '01960000-0000-7000-8000-000000000001', 'anki', 'Spanish A2', '{}', '2026-01-01T12:00:00Z', '2026-01-01T12:00:00Z');

INSERT INTO cards (id, deck_id, front, back, tags_json, stability, difficulty, due, last_review, state, reps, lapses) VALUES
    ('01960000-0000-7000-8000-000000000020', '01960000-0000-7000-8000-000000000010', 'casa',   'house',   '["noun"]', 0.0, 0.0, '2026-05-24T00:00:00Z', NULL, 'new', 0, 0),
    ('01960000-0000-7000-8000-000000000021', '01960000-0000-7000-8000-000000000010', 'correr', 'to run',  '["verb"]', 0.0, 0.0, '2026-05-24T00:00:00Z', NULL, 'new', 0, 0),
    ('01960000-0000-7000-8000-000000000022', '01960000-0000-7000-8000-000000000010', 'libro',  'book',    '["noun"]', 0.0, 0.0, '2026-05-24T00:00:00Z', NULL, 'new', 0, 0),
    ('01960000-0000-7000-8000-000000000023', '01960000-0000-7000-8000-000000000010', 'comer',  'to eat',  '["verb"]', 0.0, 0.0, '2026-05-24T00:00:00Z', NULL, 'new', 0, 0),
    ('01960000-0000-7000-8000-000000000024', '01960000-0000-7000-8000-000000000010', 'agua',   'water',   '["noun"]', 0.0, 0.0, '2026-05-24T00:00:00Z', NULL, 'new', 0, 0);
