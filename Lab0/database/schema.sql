CREATE TABLE IF NOT EXISTS users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(40) NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 40),
  email varchar(254) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash char(64) PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS movies (
  id integer PRIMARY KEY,
  title varchar(150) NOT NULL,
  original_title varchar(150) NOT NULL,
  year integer NOT NULL,
  director varchar(100) NOT NULL,
  duration integer NOT NULL CHECK (duration > 0),
  description text NOT NULL,
  poster text NOT NULL,
  accent varchar(7) NOT NULL
);
CREATE TABLE IF NOT EXISTS genres (
  id integer PRIMARY KEY,
  name varchar(40) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS movie_genres (
  movie_id integer REFERENCES movies(id) ON DELETE CASCADE,
  genre_id integer REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY(movie_id, genre_id)
);
CREATE TABLE IF NOT EXISTS quotes (
  id integer PRIMARY KEY,
  movie_id integer NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  text text NOT NULL,
  UNIQUE(id, movie_id)
);
CREATE TABLE IF NOT EXISTS reviews (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id integer NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (length(trim(text)) BETWEEN 10 AND 5000),
  rating integer NOT NULL CHECK(rating BETWEEN 1 AND 10),
  quote_id integer,
  spoiler boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, movie_id),
  FOREIGN KEY(quote_id, movie_id) REFERENCES quotes(id, movie_id)
);
CREATE INDEX IF NOT EXISTS reviews_user_date_idx ON reviews(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_date_idx ON reviews(created_at DESC);
