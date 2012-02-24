package com.voltdb.test.typetest.proc;

import java.math.BigDecimal;

import org.voltdb.*;

@ProcInfo (
		partitionInfo = "typetest.test_id:0",
		singlePartition = true)
public class Insert extends VoltProcedure {
	
	public static final long SUCCESS = 0;
	
	public final SQLStmt insertStmt = new SQLStmt(
			"insert into typetest " 
			/*+ " ( test_id"
			+ ",test_tiny"
			+ ",test_small"
			+ ",test_integer"
			+ ",test_big"
			+ ",test_float"
			+ ",test_decimal"
			+ ",test_varchar"
			+ ",test_varbinary"
			+ ",test_timestamp )" */
			+ " values ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ? );");
			
	public long run( int id, byte tiny, short small,
			int integer, long big, double dbl, BigDecimal decimal, 
			String str, byte[] ba, long timestamp ) throws VoltAbortException {
		
		voltQueueSQL( insertStmt, id, tiny, small, integer, big, dbl, decimal, 
				str, ba, timestamp );
		
		voltExecuteSQL();
		return Insert.SUCCESS;
	}
}
