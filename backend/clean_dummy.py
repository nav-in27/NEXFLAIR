import psycopg2

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/meikaan')
cur = conn.cursor()

# Clean verification_sessions
cur.execute("DELETE FROM verification_sessions WHERE worker_id IN (SELECT w.id FROM workers w JOIN users u ON w.user_id = u.id WHERE u.email != 'worker@meikaan.gov')")

# Ticket Evidence has a foreign key to tickets, and tickets are deleted, so we should rely on CASCADE or just delete all evidence linked to deleted tickets.
cur.execute("DELETE FROM ticket_evidence WHERE ticket_id IN (SELECT t.id FROM tickets t WHERE t.assigned_worker_id IN (SELECT w.id FROM workers w JOIN users u ON w.user_id = u.id WHERE u.email != 'worker@meikaan.gov'))")

# Clean tickets
cur.execute("DELETE FROM tickets WHERE assigned_worker_id IN (SELECT w.id FROM workers w JOIN users u ON w.user_id = u.id WHERE u.email != 'worker@meikaan.gov')")

# Clean workers
cur.execute("DELETE FROM workers WHERE id IN (SELECT w.id FROM workers w JOIN users u ON w.user_id = u.id WHERE u.email != 'worker@meikaan.gov')")

# Clean users
cur.execute("DELETE FROM users WHERE email != 'worker@meikaan.gov' AND email != 'admin@meikaan.gov' AND email != 'reviewer@meikaan.gov'")

conn.commit()
conn.close()
print("Cleaned up dummy test data successfully!")
