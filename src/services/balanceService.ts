import type { BankAccount, Transaction } from "../types/finance";

/**
 * The current balance of an account is always derived, never stored:
 *   saldo = saldo inicial + receitas − despesas + transferências recebidas
 *           − transferências enviadas
 *
 * Credit-card purchases never appear here (they carry a cardId, not this
 * account's id) — only the invoice payment transaction, which is a normal
 * expense against the account used to pay it, touches the balance.
 */
export function computeAccountBalance(account: BankAccount, transactions: Transaction[]): number {
  let balance = account.initialBalance;

  for (const t of transactions) {
    if (t.type === "transfer") {
      if (t.accountId === account.id) balance -= t.amount;
      if (t.destinationAccountId === account.id) balance += t.amount;
      continue;
    }
    if (t.accountId !== account.id) continue;
    if (t.type === "income") balance += t.amount;
    else if (t.type === "expense") balance -= t.amount;
  }

  return balance;
}

export function computeTotalBalance(accounts: BankAccount[], transactions: Transaction[]): number {
  return accounts.reduce((sum, account) => sum + computeAccountBalance(account, transactions), 0);
}
