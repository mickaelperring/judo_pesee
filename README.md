docker exec -it judo-pesee-g-db-1 pg_dump -U user -d judo_db -F c -f backup.dump ; docker cp judo-pesee-g-db-1:backup.dump .

docker exec -it judo-pesee-g-db-1 psql -U user -d judo_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO \"user\"; GRANT ALL ON SCHEMA public TO public;" ; docker cp backup.dump judo-pesee-g-db-1:. ; docker exec -it judo-pesee-g-db-1 pg_restore -U user -d judo_db backup.dump

