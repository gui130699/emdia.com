import { describe, expect, it } from "vitest";
import { parseOfx } from "./ofxParser";

describe("parseOfx", () => {
  it("recognizes a Nubank bank statement from ORG/FID and preserves balances/timestamps", () => {
    const parsed = parseOfx(`OFXHEADER:100\n<OFX>\n<SIGNONMSGSRSV1><SONRS><FI><ORG>NU PAGAMENTOS S.A.\n<FID>260\n</FI></SONRS></SIGNONMSGSRSV1>\n<BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL\n<BANKACCTFROM><BANKID>260\n<BRANCHID>0001\n<ACCTID>123456\n<ACCTTYPE>CHECKING\n</BANKACCTFROM><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT\n<DTPOSTED>20260815103000[-3:BRT]\n<TRNAMT>-49.07\n<FITID>same-id\n<NAME>Compra 4/12\n</STMTTRN><STMTTRN><TRNTYPE>DEBIT\n<DTPOSTED>20260816103000[-3:BRT]\n<TRNAMT>-10.00\n<FITID>same-id\n<NAME>Outra compra\n</STMTTRN></BANKTRANLIST><LEDGERBAL><BALAMT>392.01\n<DTASOF>20260816120000[-3:BRT]\n</LEDGERBAL><AVAILBAL><BALAMT>350.00\n<DTASOF>20260816120000[-3:BRT]\n</AVAILBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`);
    expect(parsed.financialProduct).toBe("bank_account");
    expect(parsed.fid).toBe("260");
    expect(parsed.currency).toBe("BRL");
    expect(parsed.balance?.amount).toBe(392.01);
    expect(parsed.availableBalance?.amount).toBe(350);
    expect(parsed.balance?.asOfDateTime).toContain("T12:00:00-03:00");
    expect(parsed.transactions).toHaveLength(2);
    expect(parsed.transactions[0].fitId).toBe(parsed.transactions[1].fitId);
  });

  it("recognizes a credit-card structure without treating BALAMT as a limit", () => {
    const parsed = parseOfx(`OFXHEADER:100\n<OFX>\n<SIGNONMSGSRSV1><SONRS><FI><ORG>NU PAGAMENTOS S.A.\n<FID>260\n</FI></SONRS></SIGNONMSGSRSV1>\n<CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><CURDEF>BRL\n<CCACCTFROM><ACCTID>9999\n</CCACCTFROM><BANKTRANLIST></BANKTRANLIST><LEDGERBAL><BALAMT>-441.63\n<DTASOF>20260816120000[-3:BRT]\n</LEDGERBAL></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`);
    expect(parsed.financialProduct).toBe("credit_card");
    expect(parsed.balance?.amount).toBe(-441.63);
    expect(parsed.creditLimit).toBeUndefined();
  });
});
