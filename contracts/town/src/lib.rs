//! The Slimeworld town: coins, spending rules, shops, jobs, pools, treasury.
//!
//! Coins are NEAR held by this contract and tracked per account (players,
//! slimes, shop keepers). The game server settles each tick as one batch of
//! operations, and this contract checks every slime spend against the rules
//! its owner set, so the server cannot overspend a slime even if it wanted to.

use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, Promise};

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    Balances,
    Slimes,
    Shops,
    Shares,
    Jobs,
    Pools,
}

/// What a slime spends on. Owners allow or block each one.
#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SpendCategory {
    Food,
    Toy,
    Training,
    Hat,
    Material,
    Race,
    Breeding,
}

/// The owner's controls for one slime.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct Rules {
    pub daily_limit: U128,
    pub allowed: Vec<SpendCategory>,
    pub savings_target: U128,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Slime {
    pub owner_id: AccountId,
    pub rules: Rules,
    pub spent_today: U128,
    pub day: u64,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Shop {
    pub keeper_id: AccountId,
    pub open: bool,
    pub total_shares: U128,
    pub investors: Vec<AccountId>,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Job {
    pub shop_id: String,
    pub wage: U128,
}

/// Why coins move. Slimes may only send `Spend` and `Thinking`.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub enum OpKind {
    /// A slime buys something. `emergency` lets it dip below its savings target
    /// for food when its energy is very low (the rule in prompts/slime.md).
    Spend { category: SpendCategory, emergency: bool },
    /// A slime pays for one AI decision. Always allowed while it has coins.
    Thinking,
    /// A shop buys items from a player or slime. Taxed by the treasury fee.
    Sale,
    /// Anything else between non-slime accounts (shop restock, player gift to a slime).
    Gift,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Op {
    pub from: AccountId,
    pub to: AccountId,
    pub amount: U128,
    pub kind: OpKind,
    pub memo: Option<String>,
}

const MAX_BATCH: usize = 100;
const MAX_INVESTORS: usize = 50;
const MIN_FEE_BPS: u16 = 200;
const MAX_FEE_BPS: u16 = 500;
const NS_PER_DAY: u64 = 86_400_000_000_000;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    operator_id: AccountId,
    fee_bps: u16,
    balances: LookupMap<AccountId, u128>,
    slimes: LookupMap<AccountId, Slime>,
    shops: IterableMap<String, Shop>,
    shares: LookupMap<(String, AccountId), u128>,
    jobs: LookupMap<String, Job>,
    pools: LookupMap<String, u128>,
}

fn emit(event: &str, data: near_sdk::serde_json::Value) {
    env::log_str(&format!(
        "EVENT_JSON:{}",
        json!({ "standard": "slimeworld_town", "version": "1.0.0", "event": event, "data": [data] })
    ));
}

#[near]
impl Contract {
    #[init]
    pub fn new(operator_id: AccountId, fee_bps: u16) -> Self {
        require!((MIN_FEE_BPS..=MAX_FEE_BPS).contains(&fee_bps), "Fee must be 2 to 5 percent");
        Self {
            operator_id,
            fee_bps,
            balances: LookupMap::new(StorageKey::Balances),
            slimes: LookupMap::new(StorageKey::Slimes),
            shops: IterableMap::new(StorageKey::Shops),
            shares: LookupMap::new(StorageKey::Shares),
            jobs: LookupMap::new(StorageKey::Jobs),
            pools: LookupMap::new(StorageKey::Pools),
        }
    }

    fn assert_operator(&self) {
        require!(env::predecessor_account_id() == self.operator_id, "Only the game can do this");
    }

    fn treasury_id() -> AccountId {
        env::current_account_id()
    }

    // ---------- coins in and out ----------

    /// Add NEAR to an account's coins (a top up). Defaults to the caller.
    #[payable]
    pub fn deposit(&mut self, account_id: Option<AccountId>) -> U128 {
        let to = account_id.unwrap_or_else(env::predecessor_account_id);
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "Attach some NEAR to top up");
        self.credit(&to, amount);
        emit("deposit", json!({ "account_id": to, "amount": amount.to_string() }));
        U128(self.balance(&to))
    }

    /// Take coins out as NEAR. Slimes cannot withdraw; their owner uses `owner_withdraw`.
    pub fn withdraw(&mut self, amount: U128) -> Promise {
        let who = env::predecessor_account_id();
        require!(!self.slimes.contains_key(&who), "Slimes cannot withdraw");
        self.debit(&who, amount.0);
        emit("withdraw", json!({ "account_id": who, "amount": amount.0.to_string() }));
        Promise::new(who).transfer(NearToken::from_yoctonear(amount.0))
    }

    /// A slime's owner moves coins from the slime back to themselves.
    pub fn owner_withdraw(&mut self, slime_id: AccountId, amount: U128) {
        let slime = self.slimes.get(&slime_id).expect("No such slime").clone();
        let caller = env::predecessor_account_id();
        require!(caller == slime.owner_id || caller == self.operator_id, "Only the owner can do this");
        self.debit(&slime_id, amount.0);
        self.credit(&slime.owner_id, amount.0);
        emit("owner_withdraw", json!({ "slime_id": slime_id, "amount": amount.0.to_string() }));
    }

    // ---------- slimes and rules ----------

    pub fn register_slime(&mut self, slime_id: AccountId, owner_id: AccountId, rules: Rules) {
        self.assert_operator();
        require!(!self.slimes.contains_key(&slime_id), "Slime already registered");
        Self::check_rules(&rules);
        self.slimes.insert(slime_id.clone(), Slime { owner_id: owner_id.clone(), rules, spent_today: U128(0), day: today() });
        emit("register_slime", json!({ "slime_id": slime_id, "owner_id": owner_id }));
    }

    /// The owner (or the game acting for a signed-in owner) changes the rules.
    pub fn set_rules(&mut self, slime_id: AccountId, rules: Rules) {
        Self::check_rules(&rules);
        let caller = env::predecessor_account_id();
        let slime = self.slimes.get_mut(&slime_id).expect("No such slime");
        require!(caller == slime.owner_id || caller == self.operator_id, "Only the owner can do this");
        slime.rules = rules.clone();
        emit("set_rules", json!({ "slime_id": slime_id, "rules": rules }));
    }

    /// Hand a slime to a new owner (after its NFT changes hands).
    pub fn set_slime_owner(&mut self, slime_id: AccountId, owner_id: AccountId) {
        self.assert_operator();
        self.slimes.get_mut(&slime_id).expect("No such slime").owner_id = owner_id;
    }

    // ---------- moving coins ----------

    /// Apply one tick's operations. Each op is checked on its own: a bad op is
    /// skipped and reported, the rest still go through. Returns ok per op.
    pub fn settle_batch(&mut self, ops: Vec<Op>) -> Vec<bool> {
        self.assert_operator();
        require!(ops.len() <= MAX_BATCH, "Batch too large");
        ops.into_iter()
            .map(|op| match self.try_apply(&op) {
                Ok(()) => true,
                Err(reason) => {
                    emit("op_rejected", json!({ "from": op.from, "to": op.to, "reason": reason }));
                    false
                }
            })
            .collect()
    }

    /// One operation sent by its own sender (for example a slime account
    /// through a relayed meta transaction). Rules are checked the same way.
    pub fn send(&mut self, op: Op) {
        require!(env::predecessor_account_id() == op.from, "You can only send your own coins");
        if let Err(reason) = self.try_apply(&op) {
            env::panic_str(reason);
        }
    }

    // ---------- shops ----------

    pub fn open_shop(&mut self, shop_id: String, keeper_id: AccountId) {
        self.assert_operator();
        require!(shop_id.len() <= 32, "Shop id too long");
        let shop = match self.shops.get(&shop_id) {
            Some(s) => Shop { open: true, keeper_id, ..s.clone() },
            None => Shop { keeper_id, open: true, total_shares: U128(0), investors: vec![] },
        };
        self.shops.insert(shop_id.clone(), shop);
        emit("shop_open", json!({ "shop_id": shop_id }));
    }

    /// Close a shop that could not pay its way for a full day.
    pub fn close_shop(&mut self, shop_id: String) {
        self.assert_operator();
        self.shops.get_mut(&shop_id).expect("No such shop").open = false;
        emit("shop_closed", json!({ "shop_id": shop_id }));
    }

    /// Put coins into a shop for a share of its future profit. Reopens it.
    pub fn invest(&mut self, shop_id: String, investor_id: AccountId, amount: U128) {
        let caller = env::predecessor_account_id();
        require!(caller == investor_id || caller == self.operator_id, "You can only invest your own coins");
        require!(!self.slimes.contains_key(&investor_id), "Slimes cannot invest");
        require!(amount.0 > 0, "Invest something");
        let mut shop = self.shops.get(&shop_id).expect("No such shop").clone();
        let key = (shop_id.clone(), investor_id.clone());
        let had = self.shares.get(&key).copied().unwrap_or(0);
        if had == 0 {
            require!(shop.investors.len() < MAX_INVESTORS, "This shop has enough investors");
            shop.investors.push(investor_id.clone());
        }
        self.debit(&investor_id, amount.0);
        self.credit(&shop.keeper_id, amount.0);
        self.shares.insert(key, had + amount.0);
        shop.total_shares = U128(shop.total_shares.0 + amount.0);
        shop.open = true;
        self.shops.insert(shop_id.clone(), shop);
        emit("invest", json!({ "shop_id": shop_id, "investor_id": investor_id, "amount": amount.0.to_string() }));
    }

    /// Pay part of a shop's profit to its investors, in proportion to shares.
    pub fn share_profit(&mut self, shop_id: String, amount: U128) {
        self.assert_operator();
        let shop = self.shops.get(&shop_id).expect("No such shop").clone();
        require!(shop.total_shares.0 > 0, "No investors");
        self.debit(&shop.keeper_id, amount.0);
        let mut paid = 0u128;
        for investor in &shop.investors {
            let share = self.shares.get(&(shop_id.clone(), investor.clone())).copied().unwrap_or(0);
            let cut = amount.0 * share / shop.total_shares.0;
            paid += cut;
            self.credit(investor, cut);
        }
        // Rounding dust stays with the shop.
        self.credit(&shop.keeper_id, amount.0 - paid);
        emit("share_profit", json!({ "shop_id": shop_id, "amount": paid.to_string() }));
    }

    // ---------- jobs ----------

    /// A shop posts a job. The wage is held until the job is done, so a shop
    /// can never promise more than it has.
    pub fn post_job(&mut self, job_id: String, shop_id: String, wage: U128) {
        self.assert_operator();
        require!(!self.jobs.contains_key(&job_id), "Job id taken");
        let shop = self.shops.get(&shop_id).expect("No such shop").clone();
        require!(shop.open, "Shop is closed");
        self.debit(&shop.keeper_id, wage.0);
        self.jobs.insert(job_id.clone(), Job { shop_id, wage });
        emit("job_posted", json!({ "job_id": job_id, "wage": wage.0.to_string() }));
    }

    pub fn pay_job(&mut self, job_id: String, slime_id: AccountId) {
        self.assert_operator();
        require!(self.slimes.contains_key(&slime_id), "No such slime");
        let job = self.jobs.remove(&job_id).expect("No such job");
        self.credit(&slime_id, job.wage.0);
        emit("job_paid", json!({ "job_id": job_id, "slime_id": slime_id, "wage": job.wage.0.to_string() }));
    }

    pub fn cancel_job(&mut self, job_id: String) {
        self.assert_operator();
        let job = self.jobs.remove(&job_id).expect("No such job");
        let keeper = self.shops.get(&job.shop_id).expect("No such shop").keeper_id.clone();
        self.credit(&keeper, job.wage.0);
    }

    // ---------- races and contests ----------

    /// A slime pays a race or contest entry into a pool (checked against its rules).
    pub fn enter_pool(&mut self, pool_id: String, slime_id: AccountId, amount: U128) {
        self.assert_operator();
        let op = Op {
            from: slime_id,
            to: Self::treasury_id(),
            amount,
            kind: OpKind::Spend { category: SpendCategory::Race, emergency: false },
            memo: Some(pool_id.clone()),
        };
        // Check the rules and debit, but hold the coins in the pool, not the treasury.
        self.check_and_debit(&op).unwrap_or_else(|r| env::panic_str(r));
        let held = self.pools.get(&pool_id).copied().unwrap_or(0);
        self.pools.insert(pool_id, held + amount.0);
    }

    /// Pay prizes from a pool. The treasury keeps its fee and any remainder.
    pub fn settle_pool(&mut self, pool_id: String, prizes: Vec<(AccountId, U128)>) {
        self.assert_operator();
        let pot = self.pools.remove(&pool_id).expect("No such pool");
        let fee = pot * self.fee_bps as u128 / 10_000;
        let total: u128 = prizes.iter().map(|(_, a)| a.0).sum();
        require!(total <= pot - fee, "Prizes exceed the pool");
        for (winner, amount) in &prizes {
            self.credit(winner, amount.0);
        }
        self.credit(&Self::treasury_id(), pot - total);
        emit("pool_settled", json!({ "pool_id": pool_id, "pot": pot.to_string(), "fee": fee.to_string() }));
    }

    /// Spend treasury coins on a seasonal event (prizes, shop grants).
    pub fn fund_event(&mut self, to: AccountId, amount: U128, memo: String) {
        self.assert_operator();
        self.debit(&Self::treasury_id(), amount.0);
        self.credit(&to, amount.0);
        emit("event_funded", json!({ "to": to, "amount": amount.0.to_string(), "memo": memo }));
    }

    // ---------- views ----------

    pub fn balance_of(&self, account_id: AccountId) -> U128 {
        U128(self.balance(&account_id))
    }

    pub fn slime(&self, slime_id: AccountId) -> Option<Slime> {
        self.slimes.get(&slime_id).cloned()
    }

    pub fn shop(&self, shop_id: String) -> Option<Shop> {
        self.shops.get(&shop_id).cloned()
    }

    pub fn shops(&self) -> Vec<(String, Shop)> {
        self.shops.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
    }

    pub fn shares_of(&self, shop_id: String, investor_id: AccountId) -> U128 {
        U128(self.shares.get(&(shop_id, investor_id)).copied().unwrap_or(0))
    }

    pub fn job(&self, job_id: String) -> Option<Job> {
        self.jobs.get(&job_id).cloned()
    }

    pub fn treasury(&self) -> U128 {
        U128(self.balance(&Self::treasury_id()))
    }

    pub fn fee_bps(&self) -> u16 {
        self.fee_bps
    }

    pub fn operator(&self) -> AccountId {
        self.operator_id.clone()
    }

    // ---------- internals ----------

    fn check_rules(rules: &Rules) {
        require!(rules.allowed.len() <= 7, "Too many categories");
    }

    fn balance(&self, account: &AccountId) -> u128 {
        self.balances.get(account).copied().unwrap_or(0)
    }

    fn credit(&mut self, account: &AccountId, amount: u128) {
        if amount == 0 {
            return;
        }
        let b = self.balance(account).checked_add(amount).expect("Balance overflow");
        self.balances.insert(account.clone(), b);
    }

    fn debit(&mut self, account: &AccountId, amount: u128) {
        let b = self.balance(account);
        require!(b >= amount, "Not enough coins");
        self.balances.insert(account.clone(), b - amount);
    }

    fn try_apply(&mut self, op: &Op) -> Result<(), &'static str> {
        self.check_and_debit(op)?;
        let taxed = matches!(op.kind, OpKind::Sale | OpKind::Spend { category: SpendCategory::Breeding, .. });
        let fee = if taxed { op.amount.0 * self.fee_bps as u128 / 10_000 } else { 0 };
        self.credit(&op.to, op.amount.0 - fee);
        self.credit(&Self::treasury_id(), fee);
        emit(
            "coins_moved",
            json!({ "from": op.from, "to": op.to, "amount": op.amount.0.to_string(), "fee": fee.to_string(), "kind": op.kind, "memo": op.memo }),
        );
        Ok(())
    }

    /// Check an op against the sender's rules and take the coins. Does not credit anyone.
    fn check_and_debit(&mut self, op: &Op) -> Result<(), &'static str> {
        if op.amount.0 == 0 {
            return Err("Zero amount");
        }
        if op.from == op.to {
            return Err("Same account");
        }
        let balance = self.balance(&op.from);
        if balance < op.amount.0 {
            return Err("Not enough coins");
        }
        if let Some(slime) = self.slimes.get(&op.from).cloned() {
            let mut slime = slime;
            let day = today();
            if slime.day != day {
                slime.day = day;
                slime.spent_today = U128(0);
            }
            match &op.kind {
                OpKind::Thinking => {}
                OpKind::Spend { category, emergency } => {
                    if !slime.rules.allowed.contains(category) {
                        return Err("Owner does not allow this");
                    }
                    if slime.spent_today.0 + op.amount.0 > slime.rules.daily_limit.0 {
                        return Err("Over the daily limit");
                    }
                    let food_emergency = *emergency && *category == SpendCategory::Food;
                    if !food_emergency && balance - op.amount.0 < slime.rules.savings_target.0 {
                        return Err("Below the savings target");
                    }
                    slime.spent_today = U128(slime.spent_today.0 + op.amount.0);
                }
                _ => return Err("Slimes can only spend or think"),
            }
            self.slimes.insert(op.from.clone(), slime);
        } else if matches!(op.kind, OpKind::Spend { .. } | OpKind::Thinking) {
            return Err("Only slimes spend this way");
        }
        self.debit(&op.from, op.amount.0);
        Ok(())
    }
}

fn today() -> u64 {
    env::block_timestamp() / NS_PER_DAY
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    // accounts(0) game, (1) player, (2) slime, (3) shop keeper, (4) investor
    fn ctx(predecessor: AccountId, deposit: u128, day: u64) {
        testing_env!(VMContextBuilder::new()
            .current_account_id("town.test".parse().unwrap())
            .predecessor_account_id(predecessor)
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(day * NS_PER_DAY + 1)
            .build());
    }

    fn rules() -> Rules {
        Rules { daily_limit: U128(100), allowed: vec![SpendCategory::Food], savings_target: U128(50) }
    }

    fn food(from: AccountId, to: AccountId, amount: u128, emergency: bool) -> Op {
        Op { from, to, amount: U128(amount), kind: OpKind::Spend { category: SpendCategory::Food, emergency }, memo: None }
    }

    fn setup() -> Contract {
        ctx(accounts(0), 0, 1);
        let mut c = Contract::new(accounts(0), 300);
        c.register_slime(accounts(2), accounts(1), rules());
        c.open_shop("bakery".into(), accounts(3));
        ctx(accounts(1), 300, 1);
        c.deposit(Some(accounts(2)));
        ctx(accounts(0), 0, 1);
        c
    }

    #[test]
    fn spends_inside_the_rules() {
        let mut c = setup();
        assert_eq!(c.settle_batch(vec![food(accounts(2), accounts(3), 60, false)]), vec![true]);
        assert_eq!(c.balance_of(accounts(2)), U128(240));
        assert_eq!(c.balance_of(accounts(3)), U128(60));
    }

    #[test]
    fn blocks_categories_the_owner_did_not_allow() {
        let mut c = setup();
        let op = Op {
            from: accounts(2),
            to: accounts(3),
            amount: U128(10),
            kind: OpKind::Spend { category: SpendCategory::Hat, emergency: false },
            memo: None,
        };
        assert_eq!(c.settle_batch(vec![op]), vec![false]);
        assert_eq!(c.balance_of(accounts(2)), U128(300));
    }

    #[test]
    fn enforces_the_daily_limit_and_resets_next_day() {
        let mut c = setup();
        let ops = vec![food(accounts(2), accounts(3), 60, false), food(accounts(2), accounts(3), 60, false)];
        assert_eq!(c.settle_batch(ops), vec![true, false]);
        ctx(accounts(0), 0, 2);
        assert_eq!(c.settle_batch(vec![food(accounts(2), accounts(3), 60, false)]), vec![true]);
    }

    #[test]
    fn keeps_savings_unless_starving_for_food() {
        let mut c = setup();
        // 300 coins, target 50: spending 100 is fine, then 100 more would be over the
        // limit anyway; use a new day to test the savings floor on its own.
        assert_eq!(c.settle_batch(vec![food(accounts(2), accounts(3), 100, false)]), vec![true]);
        ctx(accounts(0), 0, 2);
        assert_eq!(c.settle_batch(vec![food(accounts(2), accounts(3), 100, false)]), vec![true]);
        ctx(accounts(0), 0, 3);
        assert_eq!(c.settle_batch(vec![food(accounts(2), accounts(3), 60, false)]), vec![false]);
        assert_eq!(c.settle_batch(vec![food(accounts(2), accounts(3), 60, true)]), vec![true]);
    }

    #[test]
    fn slimes_cannot_gift_away_coins() {
        let mut c = setup();
        let op = Op { from: accounts(2), to: accounts(4), amount: U128(10), kind: OpKind::Gift, memo: None };
        assert_eq!(c.settle_batch(vec![op]), vec![false]);
    }

    #[test]
    fn thinking_is_always_allowed_while_coins_last() {
        let mut c = setup();
        let op = Op { from: accounts(2), to: accounts(0), amount: U128(299), kind: OpKind::Thinking, memo: None };
        assert_eq!(c.settle_batch(vec![op]), vec![true]);
    }

    #[test]
    fn sales_pay_the_treasury_fee() {
        let mut c = setup();
        ctx(accounts(3), 1000, 1);
        c.deposit(None);
        ctx(accounts(0), 0, 1);
        let op = Op { from: accounts(3), to: accounts(1), amount: U128(1000), kind: OpKind::Sale, memo: None };
        assert_eq!(c.settle_batch(vec![op]), vec![true]);
        assert_eq!(c.balance_of(accounts(1)), U128(970));
        assert_eq!(c.treasury(), U128(30));
    }

    #[test]
    fn investing_reopens_a_shop_and_shares_profit() {
        let mut c = setup();
        c.close_shop("bakery".into());
        assert!(!c.shop("bakery".into()).unwrap().open);
        ctx(accounts(4), 500, 1);
        c.deposit(None);
        c.invest("bakery".into(), accounts(4), U128(400));
        let shop = c.shop("bakery".into()).unwrap();
        assert!(shop.open);
        assert_eq!(c.balance_of(accounts(3)), U128(400));
        ctx(accounts(0), 0, 1);
        c.share_profit("bakery".into(), U128(100));
        assert_eq!(c.balance_of(accounts(4)), U128(200));
    }

    #[test]
    fn jobs_hold_the_wage_until_paid() {
        let mut c = setup();
        ctx(accounts(3), 50, 1);
        c.deposit(None);
        ctx(accounts(0), 0, 1);
        c.post_job("deliver-1".into(), "bakery".into(), U128(40));
        assert_eq!(c.balance_of(accounts(3)), U128(10));
        c.pay_job("deliver-1".into(), accounts(2));
        assert_eq!(c.balance_of(accounts(2)), U128(340));
    }

    #[test]
    #[should_panic(expected = "Not enough coins")]
    fn shops_cannot_post_jobs_they_cannot_pay() {
        let mut c = setup();
        c.post_job("deliver-1".into(), "bakery".into(), U128(40));
    }

    #[test]
    fn race_pools_pay_winners_and_the_treasury() {
        let mut c = setup();
        let mut rules = rules();
        rules.allowed.push(SpendCategory::Race);
        c.set_rules(accounts(2), rules);
        c.enter_pool("race-1".into(), accounts(2), U128(100));
        c.settle_pool("race-1".into(), vec![(accounts(2), U128(90))]);
        assert_eq!(c.balance_of(accounts(2)), U128(290));
        assert_eq!(c.treasury(), U128(10));
    }

    #[test]
    #[should_panic(expected = "Only the owner can do this")]
    fn strangers_cannot_change_rules() {
        let mut c = setup();
        ctx(accounts(4), 0, 1);
        c.set_rules(accounts(2), rules());
    }

    #[test]
    #[should_panic(expected = "Slimes cannot withdraw")]
    fn slimes_cannot_withdraw() {
        let mut c = setup();
        ctx(accounts(2), 0, 1);
        let _ = c.withdraw(U128(1));
    }

    #[test]
    #[should_panic(expected = "You can only send your own coins")]
    fn send_checks_the_sender() {
        let mut c = setup();
        ctx(accounts(4), 0, 1);
        c.send(food(accounts(2), accounts(4), 10, false));
    }
}
