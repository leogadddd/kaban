import { allTables, getDatabase } from "./db";
import { addDays, toISO } from "./dates";
import { saveAccount, savePerson, saveTransaction, setMeta, type AccountInput, type TxnInput } from "./repo";
import { ME } from "./types";

/** Seed realistic sample data so the app can be explored before entering real records. */
export async function loadDemoData(db = getDatabase()) {
  return db.transaction("rw", allTables(db), async () => {
    const account = (input: AccountInput) => saveAccount(input, undefined, db);
    const person = (input: { name: string }) => savePerson(input, undefined, db);
    const transaction = (input: TxnInput) => saveTransaction(input, undefined, db);
    const d = (n: number) => toISO(addDays(new Date(), -n));
    const cash = await account({ type: "cash", name: "Wallet", openingMinor: 4_500_00, openingDate: d(60), color: "#2D936C" });
    const bpi = await account({ type: "debit", name: "Savings", issuer: "BPI", last4: "4821", openingMinor: 68_250_00, openingDate: d(60), color: "#176B4D" });
    const card = await account({
      type: "credit",
      name: "Family Card",
      issuer: "BDO",
      last4: "9013",
      openingMinor: 12_400_00,
      openingDate: d(60),
      creditLimitMinor: 120_000_00,
      closingDay: 15,
      dueDaysAfterClosing: 20,
      color: "#1F2D27",
    });
    const mom = await person({ name: "Mama" });
    const kuya = await person({ name: "Kuya Paolo" });
    await person({ name: "Bea" });

    await transaction({ type: "income", accountId: bpi, amountMinor: 42_000_00, date: d(25), description: "Salary", category: "Salary" });
    await transaction({ type: "income", accountId: bpi, amountMinor: 42_000_00, date: d(55), description: "Salary", category: "Salary" });
    await transaction({
      type: "expense",
      accountId: card,
      amountMinor: 6_000_00,
      date: d(3),
      description: "S&R groceries",
      category: "Groceries",
      arrangement: "regular",
      splits: [
        { personId: ME, amountMinor: 2_000_00 },
        { personId: mom, amountMinor: 2_000_00 },
        { personId: kuya, amountMinor: 2_000_00 },
      ],
    });
    await transaction({
      type: "expense",
      accountId: card,
      amountMinor: 24_000_00,
      date: d(20),
      description: "Refrigerator",
      category: "Home",
      arrangement: "instalment",
      instalmentCount: 6,
    });
    await transaction({ type: "expense", accountId: card, amountMinor: 3_250_00, date: d(9), description: "Meralco bill", category: "Bills & Utilities", arrangement: "regular" });
    await transaction({ type: "expense", accountId: card, amountMinor: 1_890_50, date: d(1), description: "Jollibee family meal", category: "Food & Dining", arrangement: "deferred" });
    await transaction({ type: "expense", accountId: cash, amountMinor: 185_00, date: d(0), description: "Coffee", category: "Coffee" });
    await transaction({ type: "expense", accountId: cash, amountMinor: 420_00, date: d(2), description: "Grab ride", category: "Transport" });
    await transaction({ type: "expense", accountId: bpi, amountMinor: 1_599_00, date: d(12), description: "PLDT Fiber", category: "Phone & Internet" });
    await transaction({ type: "expense", accountId: bpi, amountMinor: 2_800_00, date: d(38), description: "Pharmacy", category: "Health" });
    await transaction({ type: "expense", accountId: card, amountMinor: 5_400_00, date: d(44), description: "School supplies", category: "Education", arrangement: "regular" });
    await transaction({ type: "transfer", accountId: bpi, toAccountId: cash, amountMinor: 3_000_00, date: d(6), description: "ATM withdrawal" });
    await transaction({ type: "card_payment", accountId: bpi, toAccountId: card, amountMinor: 5_000_00, date: d(8), description: "Card payment" });
    await setMeta("demo", true, db);
  });
}
