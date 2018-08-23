/* This file is part of VoltDB.
 * Copyright (C) 2008-2018 VoltDB Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
 * OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */
package com.voltdb.test.volttable.proc;

import java.math.BigDecimal;

import org.voltdb.*;
import org.voltdb.types.TimestampType;

public class VoltTableTest extends VoltProcedure {

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

	public long run( VoltTable vt ) throws VoltAbortException {

		vt.resetRowPosition();
		vt.advanceRow();
        
		voltQueueSQL( insertStmt, 
            vt.get(0,VoltType.INTEGER), 
            vt.get(1,VoltType.TINYINT),
            vt.get(2,VoltType.SMALLINT),
            vt.get(3,VoltType.INTEGER),
            vt.get(4,VoltType.BIGINT),
            vt.get(5,VoltType.FLOAT),
            vt.get(6,VoltType.DECIMAL),
            vt.get(7,VoltType.STRING),
            vt.get(8,VoltType.VARBINARY),
            vt.get(9,VoltType.TIMESTAMP)
        );

		voltExecuteSQL();

		return VoltTableTest.SUCCESS;
	}
}
