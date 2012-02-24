package com.voltdb.test.typetest.proc;

import java.math.BigDecimal;
import java.math.MathContext;

import org.voltdb.ProcInfo;

@ProcInfo (partitionInfo = "typetest.test_id:0", singlePartition = true)
public class InitTestType extends Insert {
	
	public long run(int blah) {
		return super.run(0, (byte)1, (short)2, 3, 4l, 5.1d, new BigDecimal(6.0000001d,MathContext.DECIMAL32),
				"seven", 
				new byte[] { (byte)8, (byte)8, (byte)8, (byte)8},
				System.currentTimeMillis());
	}
}
