import Database from "better-sqlite3";
const db = new Database('app.db')

const query = `
  CREATE TABLE test (
    id INTEGER PRIMARY KEY,
    name STRING NOT NULL
  )
`;

db.exec(query);
