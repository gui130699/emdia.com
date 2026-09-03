import type { BalanceSnapshot, BankAccount, Transaction } from "../types/finance";

function movesAccount(t: Transaction, accountId: string, sinceDate?: string): number {
  if (sinceDate && t.date <= sinceDate) return 0;
  if (t.type === "transfer") {
    if (t.accountId === accountId) return -t.amount;
    if (t.destinationAccountId === accountId) return t.amount;
    return 0;
  }
  if (t.accountId !== accountId) return 0;
  if (t.type === "income") return t.amount;
  if (t.type === "expense") return -t.amount;
  return 0;
}

/**
 * The current balance of an account is always derived, never stored.
 *
 * When the account has a BalanceSnapshot (a known-good balance reported at
 * a specific date — from manual entry, an OFX ledger balance, or a
 * reconciliation), that snapshot is the base and only movements dated
 * *after* it are added — never the account's entire transaction history,
 * which would double-count whatever the snapshot already reflects.
 *
 * Only when there's no snapshot at all do we fall back to the legacy
 * initialBalance + full history behavior (e.g. accounts created before
 * this feature existed).
 */
export function computeAccountBalance(
  account: BankAccount,
  transactions: Transaction[],
  snapshots: BalanceSnapshot[] = []
): number {
  const accountSnapshots = snapshots.filter((s) => s.accountId === account.id);
  const latest = accountSnapshots.reduce<BalanceSnapshot | undefined>(
    (best, s) => (!best || s.asOfDate > best.asOfDate ? s : best),
    undefined
  );

  let balance = latest ? latest.balance : account.initialBalance;
  const sinceDate = latest?.asOfDate;

  for (const t of transactions) {
    balance += movesAccount(t, account.id, sinceDate);
  }

  return balance;
}

export function computeTotalBalance(
  accounts: BankAccount[],
  transactions: Transaction[],
  snapshots: BalanceSnapshot[] = []
): number {
  return accounts.reduce((sum, account) => sum + computeAccountBalance(account, transactions, snapshots), 0);
}
