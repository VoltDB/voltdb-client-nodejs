-- test types
CREATE TABLE typetest
(
	test_id			integer			NOT NULL,
	test_tiny       tinyint         NOT NULL,
	test_small		smallint		NOT NULL,
	test_integer	integer			NOT	NULL,
	test_big		bigint			NOT NULL,
	test_float		float			NOT NULL,
	test_decimal	decimal			NOT NULL,
	test_varchar	varchar(100)	NOT NULL,
	test_varbinary	varbinary(4)	NOT NULL,
	test_timestamp	timestamp		NOT NULL,
	CONSTRAINT PK_tests PRIMARY KEY
  	(
    	test_id
  	)
);

PARTITION TABLE typetest ON COLUMN test_id;

CREATE PROCEDURE FROM CLASS com.voltdb.test.typetest.proc.Insert;

CREATE PROCEDURE FROM CLASS com.voltdb.test.typetest.proc.InitTestType;
