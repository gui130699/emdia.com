import type { BalanceSnapshot, BankAccount, Transaction } from "../types/finance";

function instant(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function snapshotMoment(snapshot: BalanceSnapshot): number {
  return instant(snapshot.asOfDateTime ?? `${snapshot.asOfDate}T23:59:59.999`);
}

function transactionMoment(transaction: Transaction): number {
  return instant(transaction.postingDateTime ?? `${transaction.date}T00:00:00.000`);
}

function movesAccount(t: Transaction, accountId: string, since?: BalanceSnapshot): number {
  if (t.isReversed) return 0;
  if (since && transactionMoment(t) <= snapshotMoment(since)) return 0;
  if (t.type === "transfer") {
    if (t.accountId === accountId) return -t.amount;
    if (t.destinationAccountId === accountId) return t.amount;
    return 0;
  }
  if (t.accountId !== accountId) return 0;
  if (t.type === "income") return t.amount;
  if (t.type === "expense") return -t.amount;
  if (t.type === "payment") return -t.amount;
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
  snapshots: BalanceSnapshot[] = [],
  /** Restricts which snapshot counts as "latest" to ones dated at or before
   * this cutoff — needed when computing what the balance *should have been*
   * on a past date (reconciling an older file after a more recent snapshot
   * already exists). Without this, a snapshot dated after the cutoff could
   * be picked as the base, excluding every transaction up to the cutoff
   * from the count and making the historical comparison meaningless.
   * Omitted entirely for the normal "current balance right now" case. */
  asOfCutoff?: string
): number | undefined {
  const accountSnapshots = snapshots.filter(
    (s) => s.accountId === account.id && (!asOfCutoff || snapshotMoment(s) <= instant(asOfCutoff.includes("T") ? asOfCutoff : `${asOfCutoff}T23:59:59.999`))
  );
  // Two snapshots can legitimately share the same asOfDate (e.g. a manual
  // correction made today to override an earlier bad entry also dated
  // today) — a plain ">" comparison would keep whichever happened to come
  // first out of the list, which has nothing to do with which one the
  // user actually intended to be authoritative. Ties go to whichever was
  // recorded most recently.
  const latest = accountSnapshots.reduce<BalanceSnapshot | undefined>((best, s) => {
    if (!best) return s;
    const moment = snapshotMoment(s);
    const bestMoment = snapshotMoment(best);
    if (moment !== bestMoment) return moment > bestMoment ? s : best;
    const sRecordedAt = s.updatedAt || s.createdAt;
    const bestRecordedAt = best.updatedAt || best.createdAt;
    return sRecordedAt > bestRecordedAt ? s : best;
  }, undefined);

  let balance = latest ? latest.balance : account.initialBalance;
  if (balance === undefined) return undefined;

  for (const t of transactions) {
    balance += movesAccount(t, account.id, latest);
  }

  return balance;
}

export function computeTotalBalance(
  accounts: BankAccount[],
  transactions: Transaction[],
  snapshots: BalanceSnapshot[] = []
): number | undefined {
  if (accounts.length === 0) return 0;
  const known = accounts
    .map((account) => computeAccountBalance(account, transactions, snapshots))
    .filter((balance): balance is number => balance !== undefined);
  return known.length > 0 ? known.reduce((sum, balance) => sum + balance, 0) : undefined;
}

export function countUnknownAccountBalances(
  accounts: BankAccount[],
  transactions: Transaction[],
  snapshots: BalanceSnapshot[] = []
): number {
  return accounts.filter((account) => computeAccountBalance(account, transactions, snapshots) === undefined).length;
}
